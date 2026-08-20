import json
import time
from fastapi import APIRouter, HTTPException, Depends
from schemas import MealPlanRequest, SaveMealPlanRequest, LogMealRequest
import database as db
import caching
import optimizer
from ai_models import text_model
from config import logger
from security import get_current_user

router = APIRouter()

@router.post("/api/mealplan/generate")
def generate_meal_plan(req: MealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Generate a 1 to 7 day meal plan (breakfast, lunch, dinner) using Groq LLM with OpenDOSM state pricing context."""
    if not req.ingredients:
        raise HTTPException(status_code=400, detail="No ingredients provided.")
    
    num_days = max(1, min(7, req.num_days))
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][:num_days]
    
    # Build prompt instructions
    budget_line = f"Total {num_days}-day budget: RM {req.min_budget:.2f} – RM {req.max_budget:.2f}."
    calorie_line = ""
    if req.min_calories and req.max_calories:
        calorie_line = f"Daily calorie target: {req.min_calories} – {req.max_calories} kcal per day."
    elif req.max_calories:
        calorie_line = f"Maximum daily calories: {req.max_calories} kcal per day."
    
    state_line = f"The user is located in {req.state}, Malaysia. Localize cost estimates and ingredient availability accordingly." if req.state and req.state != "Any State" else ""
    halal_line = "All meals MUST be 100% halal." if req.require_halal else ""
    
    days_skeleton_list = []
    for i, name in enumerate(day_names, 1):
        days_skeleton_list.append(f'{{"day": {i}, "day_name": "{name}", "meals": {{"breakfast": {{...}}, "lunch": {{...}}, "dinner": {{...}}}}}}')
    days_skeleton_str = ",\n    ".join(days_skeleton_list)

    prompt = f"""You are a professional Malaysian meal planning nutritionist and culinary economist.

Generate a structured {num_days}-day meal plan ({', '.join(day_names)}) with Breakfast, Lunch, and Dinner for each day.

Available ingredients in the user's fridge: {', '.join(req.ingredients)}.
{budget_line}
{calorie_line}
{state_line}
{halal_line}
{req.cuisine_instruction}
{req.health_instruction}

For EACH meal in each day, provide:
- name: Recipe name (string)
- calories: Estimated calories (integer)
- protein_g: Protein in grams (integer)
- carbs_g: Carbs in grams (integer)
- fat_g: Fat in grams (integer)
- est_cost_rm: Estimated cost in RM (number)
- prep_time: Prep time in minutes (integer)
- description: 1-sentence description (string)
- key_ingredients: Array of 3-5 main ingredients used (string array)

Return ONLY valid JSON in this exact structure with all {num_days} days:
{{
  "days": [
    {days_skeleton_str}
  ],
  "summary": {{
    "total_calories": 0,
    "total_cost_rm": 0,
    "avg_daily_calories": 0
  }}
}}

Be creative with variety across days. Do NOT repeat the same meal. Maximize usage of the available fridge ingredients."""

    start_time = time.perf_counter()
    req_dict = req.dict()

    # 1. Check Real-Time Cache
    cached_plan = caching.global_cache.get("meal_plan", req_dict)
    if cached_plan:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        cached_plan["cached"] = True
        cached_plan["execution_time_ms"] = elapsed_ms
        return cached_plan

    try:
        gemini_resp = text_model.generate_content(prompt)
        raw_text = gemini_resp.text.strip()
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
        else:
            start = raw_text.find('{')
            end = raw_text.rfind('}')
            if start != -1 and end != -1:
                raw_text = raw_text[start:end+1]
        data = json.loads(raw_text)
        
        # Ensure day_name is always present
        if "days" in data:
            for idx, day_obj in enumerate(data["days"]):
                if "day_name" not in day_obj and idx < len(day_names):
                    day_obj["day_name"] = day_names[idx]
                    
        # Compute Mathematical Optimization Metrics Telemetry
        target_cal_eval = req.max_calories or (req.min_calories if req.min_calories else 2000)
        telemetry = optimizer.evaluate_meal_plan_metrics(
            plan_data=data,
            target_daily_cals=target_cal_eval,
            max_budget=req.max_budget,
            fridge_items=req.ingredients
        )
        data["optimization_telemetry"] = telemetry
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        data["cached"] = False
        data["execution_time_ms"] = elapsed_ms

        # Store in cache
        caching.global_cache.set("meal_plan", req_dict, data)

        return data
    except Exception as e:
        logger.error(f"Meal plan generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate meal plan. Please try again.")

@router.post("/api/mealplan/save")
def save_meal_plan(req: SaveMealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Save a generated meal plan to the database."""
    db.save_meal_plan(current_user["user_id"], req.plan_name, req.plan_data, req.total_calories, req.total_cost)
    return {"success": True}

@router.get("/api/mealplan/list")
def list_meal_plans(current_user: dict = Depends(get_current_user)):
    """Get all saved meal plans for the current user."""
    plans = db.get_meal_plans(current_user["user_id"])
    return {"plans": plans}

@router.put("/api/mealplan/update/{plan_id}")
def update_meal_plan(plan_id: int, req: SaveMealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Update an existing saved meal plan."""
    db.update_meal_plan(plan_id, current_user["user_id"], req.plan_name, req.plan_data, req.total_calories, req.total_cost)
    return {"success": True}

@router.delete("/api/mealplan/delete/{plan_id}")
def delete_meal_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a saved meal plan."""
    db.delete_meal_plan(plan_id)
    return {"success": True}

@router.post("/api/meal/log")
def log_meal(req: LogMealRequest, current_user: dict = Depends(get_current_user)):
    # Ensure users can only log meals for themselves
    if req.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only log meals for your own account.")
    db.log_meal(req.user_id, req.recipe_name, req.calories, req.protein, req.carbs, req.fat, req.cost_rm)
    return {"success": True}

@router.get("/api/meal/history/{user_id}")
def get_history(user_id: int, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"history": db.get_history(user_id)}

@router.get("/api/meal/stats/{user_id}")
def get_user_stats(user_id: int, start_date: str = None, end_date: str = None, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"stats": db.get_user_aggregated_stats(user_id, start_date, end_date)}
