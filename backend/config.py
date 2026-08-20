import os
import logging
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
MODEL_PATH = "culinary_assistant_model.tflite"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fridge_chef")

CLASS_NAMES = ['Bean', 'Beef', 'Bitter_Gourd', 'Bottle_Gourd', 'Brinjal', 'Broccoli', 
               'Cabbage', 'Carrot', 'Cucumber', 'Lemongrass', 'Papaya', 'Potato', 
               'Pumpkin', 'Radish', 'Tomato', 'capsicum', 'cauliflower', 
               'chilli pepper', 'eggplant', 'garlic', 'ginger', 'onion']
