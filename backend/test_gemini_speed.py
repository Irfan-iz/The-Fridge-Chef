import os, sys, json, time
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
import warnings
warnings.filterwarnings("ignore")
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

prompt = """Malaysian AI chef. Generate 5 recipe ideas as JSON.
Ingredients: ['Rice', 'Chicken', 'Egg']
Budget: RM5-15 | Halal: True | Meal: Any | Cuisine: Malaysian
Output JSON only: {"ideas":[{"name":"","description":"","tags":"","est_cost_rm":0.0,"prep_time":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"missing_items":[]}]}"""

for model_name in ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3n-e4b-it']:
    print(f"\nTesting: {model_name}")
    t = time.time()
    try:
        model = genai.GenerativeModel(model_name)
        r = model.generate_content(prompt)
        elapsed = time.time()-t
        text = r.text.strip()
        start = text.find('{'); end = text.rfind('}')
        if start != -1:
            data = json.loads(text[start:end+1])
            print(f"OK {elapsed:.2f}s | Ideas: {len(data.get('ideas',[]))}")
            print(f"First: {data['ideas'][0]['name']}")
        else:
            print(f"OK {elapsed:.2f}s - no JSON found, first 100: {text[:100]}")
        break
    except Exception as e:
        msg = str(e)
        # Extract key part of error
        if 'no longer available' in msg or 'not found' in msg.lower() or 'update your code' in msg:
            # Find recommended model
            import re
            m = re.search(r'use models/([^\s"]+)', msg)
            recommended = m.group(1) if m else 'unknown'
            print(f"FAIL {time.time()-t:.2f}s - Use instead: {recommended}")
        else:
            print(f"FAIL {time.time()-t:.2f}s - {msg[:150]}")
