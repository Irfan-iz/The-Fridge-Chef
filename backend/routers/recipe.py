import json
import time
from fastapi import APIRouter, HTTPException, Depends
from schemas import TDEECalculateRequest, RecipeIdeasRequest, FullRecipeRequest, SaveRecipeRequest
import optimizer
import caching
import dosm_pipeline
import database as db
from config import logger
from ai_models import text_model
from security import get_current_user

router = APIRouter()

@router.post("/api/optimizer/calculate-targets")
def calculate_optimization_targets(req: TDEECalculateRequest):
    """Calculates user BMR, TDEE, recommended daily calorie and macronutrient allocations."""
    return optimizer.calculate_user_tdee(
        weight_kg=req.weight_kg,
        height_cm=req.height_cm,
        age=req.age,
        gender=req.gender,
        activity_level=req.activity_level,
        health_goal=req.health_goal
    )

@router.post("/api/recipe/ideas")
def get_recipe_ideas(req: RecipeIdeasRequest):
    cal_instruction  = f"{req.min_calories}-{req.max_calories} kcal" if req.min_calories and req.max_calories else "any"
    prep_instruction = f"<{req.max_prep_time}min" if req.max_prep_time else "any"
    fridge_rule      = "STRICT: only listed ingredients, missing_items=[]" if req.strict_fridge else "FLEXIBLE: up to 3 extra pantry staples, list in missing_items"

    # Fetch DOSM prices filtered to just the user's ingredients (max 12 lines)
    all_dosm_prices = dosm_pipeline.get_price_summary_for_prompt()
    user_keywords = [ing.lower().strip() for ing in req.ingredients]
    filtered_lines = []
    for line in all_dosm_prices.split('\n'):
        ll = line.lower()
        if any(kw in ll for kw in user_keywords) or any(s in ll for s in ['oil','salt','soy sauce','pepper']):
            if line not in filtered_lines:
                filtered_lines.append(line)
    live_dosm_prices = '\n'.join(filtered_lines[:12])

    prompt = f"""Malaysian AI chef. Generate 5 recipe ideas as JSON.

Ingredients: {req.ingredients}
Budget: RM{req.min_budget:.0f}-{req.max_budget:.0f} | Calories: {cal_instruction} | Prep: {prep_instruction} | Halal: {req.require_halal} | Cuisine: {req.cuisine_instruction} | Meal: {req.meal_category}
Rule: {fridge_rule}
Health: {req.health_instruction}
DOSM prices (per retail unit): {live_dosm_prices}
Pricing: use actual quantity cost, not full unit price. Condiments <RM0.20 total.

Output JSON only: {{"ideas":[{{"name":"","description":"","tags":"","est_cost_rm":0.0,"prep_time":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"missing_items":[]}}]}}"""
    start_time = time.perf_counter()
    req_dict = req.dict()

    # 1. Check Real-Time Cache
    cached_result = caching.global_cache.get("recipe_ideas", req_dict)
    if cached_result:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        cached_result["cached"] = True
        cached_result["execution_time_ms"] = elapsed_ms
        return cached_result

    try:
        # Run Mathematical Knapsack Pairing Optimizer
        target_cal = ((req.min_calories or 300) + (req.max_calories or 800)) // 2 if (req.min_calories or req.max_calories) else 500
        opt_pairing = optimizer.optimize_ingredient_pairing(
            fridge_items=req.ingredients,
            target_calories_per_meal=target_cal,
            max_budget_per_meal=req.max_budget,
            state="Any State",
            required_halal=req.require_halal
        )

        ideas = []
        last_error = None
        for attempt in range(3):
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
                ideas = data.get("ideas", [])
                if ideas:
                    break
            except Exception as ex:
                last_error = ex
                logger.warning(f"LLM JSON parsing failed on attempt {attempt+1}: {ex}")
                time.sleep(1)
        
        if not ideas and last_error:
            raise ValueError(f"LLM failed to produce valid JSON after 3 attempts. Last error: {last_error}")

        # Calculate per-recipe optimization telemetry for each idea individually
        for idea in ideas:
            # Normalize tags to always be a comma-separated string
            if isinstance(idea.get("tags"), list):
                idea["tags"] = ", ".join(idea["tags"])
            idea_metrics = optimizer.evaluate_single_recipe_metrics(
                recipe=idea,
                target_calories=target_cal,
                max_budget=req.max_budget,
                fridge_items=req.ingredients
            )
            idea["optimization_telemetry"] = idea_metrics
            idea["optimization_score"] = idea_metrics["optimization_score"]
            idea["calorie_accuracy_pct"] = idea_metrics["calorie_accuracy_pct"]
            idea["budget_efficiency_pct"] = idea_metrics["budget_efficiency_pct"]

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        result = {
            "ideas": ideas,
            "optimization_telemetry": {
                "algorithm": "Knapsack-Greedy Multi-Objective",
                "calorie_accuracy_pct": opt_pairing.get("calorie_accuracy_pct", 95.0),
                "budget_efficiency_pct": opt_pairing.get("budget_efficiency_pct", 92.0),
                "optimization_score": opt_pairing.get("optimization_score", 90.0),
                "recommended_pairings": opt_pairing.get("selected_items", [])
            },
            "cached": False,
            "execution_time_ms": elapsed_ms
        }

        # Store in cache
        caching.global_cache.set("recipe_ideas", req_dict, result)
        return result
    except Exception as e:
        logger.error(f"Recipe ideas error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate recipe ideas. Error: {str(e)}")
    
@router.post("/api/recipe/full")
def get_full_recipe(req: FullRecipeRequest):
    cal_instruction  = f"{req.min_calories}-{req.max_calories} kcal" if req.min_calories and req.max_calories else "any"
    prep_instruction = f"<{req.max_prep_time}min" if req.max_prep_time else "any"
    fridge_rule      = "STRICT: only listed ingredients, missing_pantry_items=[]" if req.strict_fridge else "FLEXIBLE: may add pantry staples, list in missing_pantry_items"

    # DOSM prices filtered to user's ingredients only (max 12 lines)
    all_dosm_prices = dosm_pipeline.get_price_summary_for_prompt()
    user_keywords = [ing.lower().strip() for ing in req.ingredients]
    filtered_lines = []
    for line in all_dosm_prices.split('\n'):
        ll = line.lower()
        if any(kw in ll for kw in user_keywords) or any(s in ll for s in ['oil','salt','soy sauce','pepper']):
            if line not in filtered_lines:
                filtered_lines.append(line)
    live_dosm_prices = '\n'.join(filtered_lines[:12])

    prompt = f"""Generate full recipe for "{req.recipe_name}".
Ingredients: {req.ingredients} | Budget: RM{req.min_budget:.0f}-{req.max_budget:.0f} | Cal: {cal_instruction} | Prep: {prep_instruction} | Halal: {req.require_halal} | Cuisine: {req.cuisine_instruction} | Meal: {req.meal_category}
Rule: {fridge_rule} | Health: {req.health_instruction}
DOSM prices (per retail unit, use actual portion cost): {live_dosm_prices}
Condiments <RM0.20. Format ingredients as "Name (Qty)".

Output JSON only: {{"recipe_name":"","cultural_tag":"","cost_rm":0.0,"calories":0,"prep_time":0,"nutrition":{{"protein_g":0,"carbs_g":0,"fat_g":0}},"missing_pantry_items":[],"ingredients":[{{"item":"Name (Qty)","cost":0.0}}],"instructions":["step1","step2"]}}"""

    try:
        data = None
        last_error = None
        for attempt in range(3):
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
                if data:
                    break
            except Exception as ex:
                last_error = ex
                logger.warning(f"LLM full recipe parsing failed on attempt {attempt+1}: {ex}")
                import time
                time.sleep(1)
        
        if not data and last_error:
            raise ValueError(f"LLM failed to produce valid JSON after 3 attempts. Last error: {last_error}")

        # Recalculate cost_rm from actual ingredient costs — don't trust Groq's total
        ingredients = data.get("ingredients", [])
        if ingredients:
            calculated_total = sum(
                float(i.get("cost", 0)) for i in ingredients
            )
            data["cost_rm"] = round(calculated_total, 2)

        return data
    except Exception as e:
        logger.error(f"Full recipe error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to generate recipe. Error: {str(e)}")

@router.post("/api/recipe/save")
def save_recipe(req: SaveRecipeRequest, current_user: dict = Depends(get_current_user)):
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only save recipes to your own cookbook.")
    db.save_recipe(req.username, req.recipe_name, req.ingredients_json, req.instructions_json)
    return {"success": True}

@router.get("/api/recipe/saved/{username}")
def get_saved_recipes(username: str, current_user: dict = Depends(get_current_user)):
    if username != current_user["username"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"recipes": db.get_saved_recipes(username)}

@router.delete("/api/recipe/delete/{recipe_id}")
def delete_recipe(recipe_id: int, current_user: dict = Depends(get_current_user)):
    db.delete_recipe(recipe_id)
    return {"success": True}


