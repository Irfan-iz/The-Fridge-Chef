from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
from PIL import Image
import PIL.PngImagePlugin
import PIL.JpegImagePlugin
import io
import re
import google.generativeai as genai
from groq import Groq
import json
import database as db
import dosm_pipeline
import optimizer
import caching
import os
import logging
import time
from dotenv import load_dotenv
from jose import JWTError, jwt
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

# ==========================================
# CONFIGURATION
# ==========================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-change-me")
JWT_ALGORITHM  = "HS256"
JWT_EXPIRE_HOURS = 24
MODEL_PATH     = "culinary_assistant_model.tflite"

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fridge_chef")

CLASS_NAMES = ['Bean', 'Beef', 'Bitter_Gourd', 'Bottle_Gourd', 'Brinjal', 'Broccoli', 
               'Cabbage', 'Carrot', 'Cucumber', 'Lemongrass', 'Papaya', 'Potato', 
               'Pumpkin', 'Radish', 'Tomato', 'capsicum', 'cauliflower', 
               'chilli pepper', 'eggplant', 'garlic', 'ginger', 'onion']

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-3.6-flash')      # vision model (scan)
text_model   = genai.GenerativeModel('gemini-3.5-flash-lite') # text generation (recipes) - fast, no thinking
groq_client  = Groq(api_key=GROQ_API_KEY)

# TFLite
interpreter = None
input_details = None
output_details = None
try:
    import tensorflow as tf
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    logger.info("TFLite model loaded successfully.")
except Exception as e:
    logger.warning(f"TFLite not loaded: {e}")

# ==========================================
# APP SETUP
# ==========================================
app = FastAPI(title="Fridge Chef API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
db.init_db()

# ==========================================
# JWT AUTHENTICATION
# ==========================================
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login", auto_error=False)

def create_access_token(data: dict):
    """Create a JWT token with expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validate JWT token and return the current user. Raises 401 if invalid."""
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return {"username": username, "user_id": user_id, "is_admin": payload.get("is_admin", False)}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid. Please log in again.")

def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin privileges."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse(os.path.join(frontend_path, "pages", "dashboard.html"))

@app.get("/admin")
def serve_admin():
    return FileResponse(os.path.join(frontend_path, "pages", "admin.html"))

@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(os.path.join(frontend_path, "manifest.json"))

@app.get("/service-worker.js")
def serve_sw():
    return FileResponse(os.path.join(frontend_path, "service-worker.js"))

# ==========================================
# PYDANTIC MODELS
# ==========================================
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    phone_number: str
    age: int
    gender: str
    height: float
    weight: float
    activity_level: str
    health_goal: str
    allergies: str = ""

class UpdateProfileRequest(BaseModel):
    username: str
    phone_number: str
    age: int
    gender: str
    height: float
    weight: float
    activity_level: str
    health_goal: str
    allergies: str = ""

class RecipeIdeasRequest(BaseModel):
    ingredients: List[str]
    min_budget: float
    max_budget: float
    min_calories: Optional[int] = None
    max_calories: Optional[int] = None
    require_halal: bool = True
    max_prep_time: Optional[int] = None
    strict_fridge: bool = False
    meal_category: str = "Any Meal"
    cuisine_instruction: str = "Prioritize general Malaysian local cuisine."
    health_instruction: str = ""

class MealPlanRequest(BaseModel):
    ingredients: List[str]
    min_budget: float
    max_budget: float
    num_days: int = 3
    state: str = "Any State"
    meal_types: List[str] = ["breakfast", "lunch", "dinner"]
    min_calories: Optional[int] = None
    max_calories: Optional[int] = None
    require_halal: bool = True
    cuisine_instruction: str = "Prioritize general Malaysian local cuisine."
    health_instruction: str = ""

class SaveMealPlanRequest(BaseModel):
    plan_name: str = "My Meal Plan"
    plan_data: str
    total_calories: int = 0
    total_cost: float = 0.0

class FullRecipeRequest(BaseModel):
    recipe_name: str
    ingredients: List[str]
    min_budget: float
    max_budget: float
    min_calories: Optional[int] = None
    max_calories: Optional[int] = None
    require_halal: bool = True
    max_prep_time: Optional[int] = None
    strict_fridge: bool = False
    meal_category: str = "Any Meal"
    cuisine_instruction: str = "Prioritize general Malaysian local cuisine."
    health_instruction: str = ""

class LogMealRequest(BaseModel):
    user_id: int
    recipe_name: str
    calories: int
    protein: int
    carbs: int
    fat: int
    cost_rm: float

class SaveRecipeRequest(BaseModel):
    username: str
    recipe_name: str
    ingredients_json: str
    instructions_json: str

class AddShoppingRequest(BaseModel):
    username: str
    recipe_name: str = "General"
    items: List[str]

class TDEECalculateRequest(BaseModel):
    weight_kg: float = 65.0
    height_cm: float = 170.0
    age: int = 25
    gender: str = "Male"
    activity_level: str = "Sedentary"
    health_goal: str = "Maintain Current Weight"

# ==========================================
# AUTH
# ==========================================
def check_password_strength(password):
    if len(password) < 8: return False, "Password must be at least 8 characters."
    if not re.search(r"[a-z]", password): return False, "Must contain a lowercase letter."
    if not re.search(r"[A-Z]", password): return False, "Must contain an uppercase letter."
    if not re.search(r"\d", password): return False, "Must contain a number."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password): return False, "Must contain a special character."
    return True, "OK"

@app.post("/api/login")
def login(req: LoginRequest):
    user = db.login_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
    # Create JWT token
    is_admin = user["username"] == "Admin"
    access_token = create_access_token({
        "sub": user["username"],
        "user_id": user["id"],
        "is_admin": is_admin
    })
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["id"],
        "username": user["username"],
        "phone_number": user.get("phone_number", ""),
        "age": user.get("age", 25),
        "gender": user.get("gender", "Male"),
        "height": user.get("height", 170),
        "weight": user.get("weight", 65),
        "activity_level": user.get("activity_level", "Sedentary (Little to no exercise)"),
        "bmi": user.get("bmi", 22.5),
        "health_goal": user.get("health_goal", "Maintain Current Weight"),
        "allergies": user.get("allergies", ""),
        "is_admin": is_admin
    }

@app.post("/api/register")
def register(req: RegisterRequest):
    ok, msg = check_password_strength(req.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    h = req.height / 100
    bmi = round(req.weight / (h * h), 1)
    success = db.add_user(req.username, req.password, req.phone_number, req.age, req.gender,
                          req.height, req.weight, req.activity_level, bmi, req.health_goal, req.allergies)
    if not success:
        raise HTTPException(status_code=409, detail="Username already taken.")
    return {"success": True, "bmi": bmi}

@app.post("/api/profile/update")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    # Ensure users can only update their own profile
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only update your own profile.")
    h = req.height / 100
    bmi = round(req.weight / (h * h), 1)
    db.update_user_profile(req.username, req.phone_number, req.age, req.gender,
                           req.height, req.weight, req.activity_level, bmi, req.health_goal, req.allergies)
    return {"success": True, "bmi": bmi}

# ==========================================
# VISION
# ==========================================
def preprocess_image(image):
    input_shape = input_details[0]['shape']
    h, w = input_shape[1], input_shape[2]
    img = image.resize((w, h))
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)

@app.post("/api/scan/cnn")
async def scan_cnn(file: UploadFile = File(...)):
    if interpreter is None:
        raise HTTPException(status_code=503, detail="CNN model not available.")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    input_data = preprocess_image(image)
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])
    idx = int(np.argmax(output_data[0]))
    confidence = float(output_data[0][idx])
    name = CLASS_NAMES[idx]
    return {"ingredient": name, "confidence": round(confidence * 100, 1)}

@app.post("/api/scan/gemini")
async def scan_gemini(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        prompt = "Identify all the raw vegetables, fruits, meats, or proteins in this image. Return ONLY a comma-separated list of capitalized words (e.g., Cabbage, Carrot, Chicken). Do not use quotes, bullet points, or sentences."
        response = gemini_model.generate_content([prompt, image])
            
        response_text = (getattr(response, 'text', '') or '').strip()
        if not response_text:
            return {"items": []}
        items = []
        for item in response_text.split(','):
            cleaned = item.strip().replace('"','').replace("'",'').replace('\n','').strip()
            if cleaned:
                items.append(cleaned.title())
        return {"items": items}
    except Exception as e:
        logger.error(f"Gemini scan error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during image scanning. Please try again.")

@app.get("/api/dosm-prices")
def get_dosm_prices():
    # 🌟 Fetch the live list of all items from the DOSM pipeline
    live_prices = dosm_pipeline.get_all_items()
    return {"prices": live_prices}

# ==========================================
# CALORIE & NUTRITION OPTIMIZER
# ==========================================
@app.post("/api/optimizer/calculate-targets")
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

# ==========================================
# RECIPE (GROQ)
# ==========================================
@app.post("/api/recipe/ideas")
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
        raise HTTPException(status_code=500, detail="Failed to generate recipe ideas. Please try again.")
    
@app.post("/api/recipe/full")
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
        raise HTTPException(status_code=500, detail="Failed to generate recipe. Please try again.")

# ==========================================
# MEAL LOG
# ==========================================
@app.post("/api/meal/log")
def log_meal(req: LogMealRequest, current_user: dict = Depends(get_current_user)):
    # Ensure users can only log meals for themselves
    if req.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only log meals for your own account.")
    db.log_meal(req.user_id, req.recipe_name, req.calories, req.protein, req.carbs, req.fat, req.cost_rm)
    return {"success": True}

@app.get("/api/meal/history/{user_id}")
def get_history(user_id: int, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"history": db.get_history(user_id)}

@app.get("/api/meal/stats/{user_id}")
def get_user_stats(user_id: int, start_date: str = None, end_date: str = None, current_user: dict = Depends(get_current_user)):
    if user_id != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"stats": db.get_user_aggregated_stats(user_id, start_date, end_date)}

# ==========================================
# COOKBOOK & SHOPPING LIST
# ==========================================
@app.post("/api/recipe/save")
def save_recipe(req: SaveRecipeRequest, current_user: dict = Depends(get_current_user)):
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only save recipes to your own cookbook.")
    db.save_recipe(req.username, req.recipe_name, req.ingredients_json, req.instructions_json)
    return {"success": True}

@app.get("/api/recipe/saved/{username}")
def get_saved_recipes(username: str, current_user: dict = Depends(get_current_user)):
    if username != current_user["username"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    return {"recipes": db.get_saved_recipes(username)}

@app.delete("/api/recipe/delete/{recipe_id}")
def delete_recipe(recipe_id: int, current_user: dict = Depends(get_current_user)):
    db.delete_recipe(recipe_id)
    return {"success": True}

@app.get("/api/shopping/{username}")
def get_shopping_list(username: str, current_user: dict = Depends(get_current_user)):
    if username != current_user["username"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    items = db.get_shopping_list(username)
    
    # Attach DOSM retail reference price to each item (full retail unit price for reference)
    for item in items:
        raw_name  = item["item_name"]
        clean_name = raw_name.split("(")[0].strip()
        price = dosm_pipeline.get_price(clean_name)
        # This is the full retail reference price — label it clearly
        item["dosm_price"] = price if price is not None else None
        item["dosm_price_label"] = "per unit" if price is not None else None
        
    return {"items": items}

@app.post("/api/shopping/add")
def add_shopping(req: AddShoppingRequest, current_user: dict = Depends(get_current_user)):
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only add to your own shopping list.")
    db.add_shopping_items(req.username, req.recipe_name, req.items)
    return {"success": True}

@app.delete("/api/shopping/delete/{item_id}")
def delete_shopping_item(item_id: int, current_user: dict = Depends(get_current_user)):
    db.delete_shopping_item(item_id)
    return {"success": True}

# ==========================================
# ADMIN
# ==========================================
@app.get("/api/admin/stats")
def admin_stats(current_user: dict = Depends(require_admin)):
    stats = db.get_stats()
    stats["cache_performance"] = caching.global_cache.get_stats()
    return stats

@app.get("/api/cache/stats")
def get_cache_stats():
    return caching.global_cache.get_stats()

@app.post("/api/cache/clear")
def clear_cache(current_user: dict = Depends(require_admin)):
    caching.global_cache.clear()
    return {"success": True, "message": "Real-time cache cleared."}

@app.get("/api/admin/users")
def admin_users(current_user: dict = Depends(require_admin)):
    return {"users": db.get_all_users()}

@app.delete("/api/admin/user/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    # Prevent deleting Admin account
    conn = db.get_connection()
    user = conn.execute("SELECT username FROM Users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if user and dict(user)["username"] == "Admin":
        raise HTTPException(status_code=403, detail="Cannot delete Admin account.")
    db.delete_user(user_id)
    return {"success": True}

class ResetPasswordRequest(BaseModel):
    new_password: str

@app.post("/api/admin/user/{user_id}/reset-password")
def reset_password(user_id: int, req: ResetPasswordRequest, current_user: dict = Depends(require_admin)):
    db.reset_user_password(user_id, req.new_password)
    return {"success": True}

@app.get("/api/admin/user/{user_id}/history")
def get_user_history(user_id: int, current_user: dict = Depends(require_admin)):
    return {"history": db.get_user_history(user_id)}

@app.get("/api/admin/export/users")
def export_users(current_user: dict = Depends(require_admin)):
    from fastapi.responses import StreamingResponse
    import csv, io
    users = db.get_all_users()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id","username","phone_number","age","gender","height","weight","bmi","health_goal","activity_level","allergies"])
    writer.writeheader()
    writer.writerows(users)
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"})

# ==========================================
# WEEKLY MEAL PLANNER
# ==========================================
@app.post("/api/mealplan/generate")
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

@app.post("/api/mealplan/save")
def save_meal_plan(req: SaveMealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Save a generated meal plan to the database."""
    db.save_meal_plan(current_user["user_id"], req.plan_name, req.plan_data, req.total_calories, req.total_cost)
    return {"success": True}

@app.get("/api/mealplan/list")
def list_meal_plans(current_user: dict = Depends(get_current_user)):
    """Get all saved meal plans for the current user."""
    plans = db.get_meal_plans(current_user["user_id"])
    return {"plans": plans}

@app.put("/api/mealplan/update/{plan_id}")
def update_meal_plan(plan_id: int, req: SaveMealPlanRequest, current_user: dict = Depends(get_current_user)):
    """Update an existing saved meal plan."""
    db.update_meal_plan(plan_id, current_user["user_id"], req.plan_name, req.plan_data, req.total_calories, req.total_cost)
    return {"success": True}

@app.delete("/api/mealplan/delete/{plan_id}")
def delete_meal_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a saved meal plan."""
    db.delete_meal_plan(plan_id)
    return {"success": True}