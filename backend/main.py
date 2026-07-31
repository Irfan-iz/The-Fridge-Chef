from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import numpy as np
from PIL import Image
import io
import re
import google.generativeai as genai
from groq import Groq
import json
import database as db
import dosm_pipeline
import os

# ==========================================
# CONFIGURATION
# ==========================================
GEMINI_API_KEY = "AIzaSyAIaRdmgxZ3bhyZXGtnXIcMYyTOkDBRUwA"
GROQ_API_KEY   = "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"
MODEL_PATH     = "culinary_assistant_model.tflite"

CLASS_NAMES = ['Bean', 'Beef', 'Bitter_Gourd', 'Bottle_Gourd', 'Brinjal', 'Broccoli', 
               'Cabbage', 'Carrot', 'Cucumber', 'Lemongrass', 'Papaya', 'Potato', 
               'Pumpkin', 'Radish', 'Tomato', 'capsicum', 'cauliflower', 
               'chilli pepper', 'eggplant', 'garlic', 'ginger', 'onion']

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.5-flash')
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
    print("✅ TFLite model loaded.")
except Exception as e:
    print(f"⚠️ TFLite not loaded: {e}")

# ==========================================
# APP SETUP
# ==========================================
app = FastAPI(title="Fridge Chef API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
db.init_db()

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
    return {
        "success": True,
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
        "is_admin": user["username"] == "Admin"
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
def update_profile(req: UpdateProfileRequest):
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
        raise HTTPException(status_code=500, detail=f"Gemini scan error: {str(e)}")

@app.get("/api/dosm-prices")
def get_dosm_prices():
    # 🌟 Fetch the live list of all items from the DOSM pipeline
    live_prices = dosm_pipeline.get_all_items()
    return {"prices": live_prices}

# ==========================================
# RECIPE (GROQ)
# ==========================================
@app.post("/api/recipe/ideas")
def get_recipe_ideas(req: RecipeIdeasRequest):
    cal_instruction  = f"Between {req.min_calories} and {req.max_calories} kcal" if req.min_calories and req.max_calories else "No calorie limit"
    prep_instruction = f"Maximum {req.max_prep_time} minutes prep time." if req.max_prep_time else "No prep time limit."
    fridge_rule      = "STRICT FRIDGE MODE: You MUST ONLY use ingredients from this list. Do NOT add or suggest any ingredient not in the list. The missing_items array must always be empty." if req.strict_fridge else "FLEXIBLE MODE: Primarily use fridge ingredients but you may suggest up to 2-3 common pantry staples if needed. List any extras in missing_items."

    # 🌟 FETCH LIVE PRICES FROM PIPELINE
    live_dosm_prices = dosm_pipeline.get_price_summary_for_prompt()

    prompt = f"""
        You are a Michelin-star AI chef. Generate 5 distinct recipe ideas.
        
        AVAILABLE FRIDGE INGREDIENTS: {req.ingredients}
        
        CONSTRAINTS:
        - Budget: RM {req.min_budget:.2f} to RM {req.max_budget:.2f}
        - Meal Type: {req.meal_category}
        - Calories: {cal_instruction}
        - Prep Time: {prep_instruction}
        - Halal Required: {req.require_halal}
        - Cuisine: {req.cuisine_instruction}
        
        INGREDIENT RULE: {fridge_rule}
        HEALTH DIRECTIVE: {req.health_instruction}
        
        Malaysia OpenDOSM Median Retail Prices (price per standard retail unit):
        {live_dosm_prices}
        
        CRITICAL PRICING RULES — YOU MUST FOLLOW THESE EXACTLY:
        1. The DOSM prices above are per FULL RETAIL UNIT (e.g. per kg, per bottle, per bunch).
        2. For est_cost_rm, calculate ONLY the ACTUAL QUANTITY USED in this recipe — not the full retail price.
           Example: If chicken costs RM 9.40/kg and you use 400g, the cost is RM 3.76 (not RM 9.40).
           Example: If cooking oil costs RM 8.50/bottle and you use 2 tablespoons (approx 30ml of 1000ml bottle), the cost is RM 0.26 (not RM 8.50).
           Example: If salt costs RM 2.00/500g and you use a pinch (approx 2g), the cost is RM 0.01 (not RM 2.00).
        3. Condiments used in small amounts (salt, pepper, soy sauce, sugar) should never exceed RM 0.20 per recipe.
        4. est_cost_rm must be the SUM of all ingredient portion costs — it must be realistic and within the budget range.
        
        CRITICAL CUISINE RULE: Strictly follow the cuisine constraint. Tags must reflect the correct cuisine.
        CRITICAL MEAL RULE: Recipes must be appropriate for the Meal Type: {req.meal_category}.
        
        Output ONLY valid JSON.
        Structure: {{"ideas": [
          {{"name": "Recipe Name",
            "description": "Short delicious description",
            "tags": "CuisineType, Descriptor",
            "est_cost_rm": 12.50,
            "prep_time": 25,
            "calories": 450,
            "protein_g": 30,
            "carbs_g": 40,
            "fat_g": 15,
            "missing_items": []
          }}
        ]}}
        """
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an API that outputs ONLY valid JSON. No markdown."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        return {"ideas": data.get("ideas", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/recipe/full")
def get_full_recipe(req: FullRecipeRequest):
    cal_instruction  = f"Between {req.min_calories} and {req.max_calories} kcal" if req.min_calories and req.max_calories else "No calorie limit"
    prep_instruction = f"Maximum {req.max_prep_time} minutes prep time." if req.max_prep_time else "No prep time limit."
    fridge_rule      = "STRICT FRIDGE MODE: ONLY use ingredients from the user's fridge list. Do NOT add any ingredient not in the list. missing_pantry_items must be empty." if req.strict_fridge else "FLEXIBLE MODE: Primarily use fridge ingredients. List any additional ingredients needed in missing_pantry_items."

    # 🌟 FETCH LIVE PRICES FROM PIPELINE
    live_dosm_prices = dosm_pipeline.get_price_summary_for_prompt()

    prompt = f"""
    The user selected: "{req.recipe_name}".
    Available fridge ingredients: {req.ingredients}.
    
    CONSTRAINTS:
    - Budget: RM {req.min_budget:.2f} to RM {req.max_budget:.2f}
    - Meal Type: {req.meal_category}
    - Calories: {cal_instruction}
    - Prep Time: {prep_instruction}
    - Halal Required: {req.require_halal}
    - Cuisine: {req.cuisine_instruction}
    
    INGREDIENT RULE: {fridge_rule}
    HEALTH DIRECTIVE: {req.health_instruction}
    
    Malaysia OpenDOSM Median Retail Prices (price per standard retail unit):
    {live_dosm_prices}
    
    CRITICAL PRICING RULES — YOU MUST FOLLOW THESE EXACTLY:
    1. The DOSM prices are per FULL RETAIL UNIT (e.g. per kg, per bottle, per bunch).
    2. For each ingredient "cost" field, calculate ONLY the cost of the ACTUAL QUANTITY USED — not the full retail price.
       Example: Chicken at RM 9.40/kg, using 400g → cost = RM 3.76
       Example: Cooking oil at RM 8.50/bottle (1000ml), using 2 tablespoons (30ml) → cost = RM 0.26
       Example: Salt at RM 2.00/500g, used as a pinch (2g) → cost = RM 0.01
       Example: Garlic at RM 4.50/100g, using 3 cloves (approx 9g) → cost = RM 0.41
       Example: Black pepper at RM 6.00/50g, used to taste (1g) → cost = RM 0.12
    3. Condiments and seasonings (salt, pepper, sugar, soy sauce) used in small amounts must NEVER exceed RM 0.20 each.
    4. The "cost_rm" total must equal the SUM of all individual ingredient costs. It must be realistic and within budget.
    5. Do NOT use full retail prices as ingredient costs — this is the most common mistake to avoid.
    
    CRITICAL CUISINE ENFORCEMENT: The "cultural_tag" must match the true origin (e.g., "Western", "Italian", "Malaysian").
    CRITICAL MEAL RULE: Recipe must be appropriate for Meal Type: {req.meal_category}.
    CRITICAL INSTRUCTIONS: Write highly detailed professional culinary steps with exact heat levels, visual cues, and timings.
    CRITICAL FORMATTING: Format ingredient items as "Name (Quantity)" e.g. "Tomato (1 large)", "Chicken (400g)".
    
    Output ONLY valid JSON. No markdown.
    Structure: {{"recipe_name": "Name", "cultural_tag": "CuisineType", "cost_rm": 0.00, "calories": 450, "prep_time": 30, "nutrition": {{"protein_g": 12, "carbs_g": 40, "fat_g": 15}}, "missing_pantry_items": [], "ingredients": [{{"item": "Name (Quantity)", "cost": 0.00}}], "instructions": ["Detailed step 1...", "Detailed step 2..."]}}
    """
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an API that outputs ONLY valid JSON. No markdown."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)

        # Recalculate cost_rm from actual ingredient costs — don't trust Groq's total
        ingredients = data.get("ingredients", [])
        if ingredients:
            calculated_total = sum(
                float(i.get("cost", 0)) for i in ingredients
            )
            data["cost_rm"] = round(calculated_total, 2)

        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# MEAL LOG
# ==========================================
@app.post("/api/meal/log")
def log_meal(req: LogMealRequest):
    db.log_meal(req.user_id, req.recipe_name, req.calories, req.protein, req.carbs, req.fat, req.cost_rm)
    return {"success": True}

@app.get("/api/meal/history/{user_id}")
def get_history(user_id: int):
    return {"history": db.get_history(user_id)}

@app.get("/api/meal/stats/{user_id}")
def get_user_stats(user_id: int, start_date: str = None, end_date: str = None):
    return {"stats": db.get_user_aggregated_stats(user_id, start_date, end_date)}

# ==========================================
# COOKBOOK & SHOPPING LIST
# ==========================================
@app.post("/api/recipe/save")
def save_recipe(req: SaveRecipeRequest):
    db.save_recipe(req.username, req.recipe_name, req.ingredients_json, req.instructions_json)
    return {"success": True}

@app.get("/api/recipe/saved/{username}")
def get_saved_recipes(username: str):
    return {"recipes": db.get_saved_recipes(username)}

@app.delete("/api/recipe/delete/{recipe_id}")
def delete_recipe(recipe_id: int):
    db.delete_recipe(recipe_id)
    return {"success": True}

@app.get("/api/shopping/{username}")
def get_shopping_list(username: str):
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
def add_shopping(req: AddShoppingRequest):
    db.add_shopping_items(req.username, req.recipe_name, req.items)
    return {"success": True}

@app.delete("/api/shopping/delete/{item_id}")
def delete_shopping_item(item_id: int):
    db.delete_shopping_item(item_id)
    return {"success": True}

# ==========================================
# ADMIN
# ==========================================
@app.get("/api/admin/stats")
def admin_stats():
    return db.get_stats()

@app.get("/api/admin/users")
def admin_users():
    return {"users": db.get_all_users()}

@app.delete("/api/admin/user/{user_id}")
def delete_user(user_id: int):
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
def reset_password(user_id: int, req: ResetPasswordRequest):
    db.reset_user_password(user_id, req.new_password)
    return {"success": True}

@app.get("/api/admin/user/{user_id}/history")
def get_user_history(user_id: int):
    return {"history": db.get_user_history(user_id)}

@app.get("/api/admin/export/users")
def export_users():
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