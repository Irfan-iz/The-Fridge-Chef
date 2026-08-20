from pydantic import BaseModel
from typing import Optional, List

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
