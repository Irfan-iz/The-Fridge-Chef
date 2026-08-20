from schemas import RecipeIdeasRequest
from routers.recipe import get_recipe_ideas
import asyncio

req = RecipeIdeasRequest(
    ingredients=["chicken", "onion", "garlic"],
    min_budget=5,
    max_budget=20,
    min_calories=300,
    max_calories=800,
    require_halal=True,
    meal_category="Dinner",
    max_prep_time=30,
    strict_fridge=False,
    cuisine_instruction="Malaysian",
    health_instruction="None"
)

try:
    print(get_recipe_ideas(req))
except Exception as e:
    import traceback
    traceback.print_exc()