import os, sys, json
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

prompt = """Malaysian AI chef. Generate 5 recipe ideas as JSON.
Ingredients: ['Rice', 'Chicken', 'Egg']
Budget: RM5-15 | Halal: True | Meal: Any | Cuisine: Malaysian
Output JSON only: {"ideas":[{"name":"","description":"","tags":"","est_cost_rm":0.0,"prep_time":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"missing_items":[]}]}"""

for model_name in ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"]:
    print(f"\n=== {model_name} ===")
    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        text = response.text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        else:
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
        data = json.loads(text)
        print(f"SUCCESS! Got {len(data.get('ideas', []))} ideas")
        print(f"First idea: {data['ideas'][0]['name']}")
        break  # stop at first working model
    except Exception as e:
        print(f"ERROR: {e}")
