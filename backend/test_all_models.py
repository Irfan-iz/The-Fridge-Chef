import os, sys, json
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq

client = Groq()

# Simulate a real recipe ideas prompt like the app sends
prompt = """
    You are a Michelin-star AI chef. Generate 5 distinct recipe ideas.
    
    AVAILABLE FRIDGE INGREDIENTS: ['chicken', 'rice', 'eggs', 'onion']
    
    CONSTRAINTS:
    - Budget: RM 5.00 to RM 15.00
    - Meal Type: Any
    - Calories: Under 700 kcal per meal
    - Prep Time: Under 30 minutes
    - Halal Required: True
    - Cuisine: Any
    
    INGREDIENT RULE: Use at least 2 of the available ingredients.
    HEALTH DIRECTIVE: Focus on balanced nutrition.
    
    Malaysia OpenDOSM Median Retail Prices:
    chicken: RM 9.40/kg, rice: RM 2.60/kg, eggs: RM 0.45/each, onion: RM 3.20/kg
    
    Output ONLY valid JSON.
    Structure: {"ideas": [
      {"name": "Recipe Name",
        "description": "Short delicious description",
        "tags": "CuisineType, Descriptor",
        "est_cost_rm": 12.50,
        "prep_time": 25,
        "calories": 450,
        "protein_g": 30,
        "carbs_g": 40,
        "fat_g": 15,
        "missing_items": []
      }
    ]}
"""

for model in ['openai/gpt-oss-20b', 'groq/compound', 'groq/compound-mini']:
    print(f"\n=== Testing model: {model} ===")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {'role': 'system', 'content': 'You are an API that outputs ONLY valid JSON. No markdown.'},
                {'role': 'user', 'content': prompt}
            ]
        )
        content = response.choices[0].message.content or ""
        finish = response.choices[0].finish_reason
        print(f"Finish reason: {finish}")
        print(f"Content length: {len(content)}")
        print(f"First 200 chars: {repr(content[:200])}")
        if content.strip():
            # Try to parse
            text = content.strip()
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
            data = json.loads(text)
            print(f"JSON parsed OK! Got {len(data.get('ideas', []))} ideas.")
    except Exception as e:
        print(f"ERROR: {e}")
