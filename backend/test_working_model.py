import os, sys, json
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq

client = Groq()

prompt = """Malaysian AI chef. Generate 5 recipe ideas as JSON.
Ingredients: ['Rice', 'Chicken', 'Egg']
Budget: RM5-15 | Halal: True | Meal: Any
Output JSON only: {"ideas":[{"name":"","description":"","tags":"","est_cost_rm":0.0,"prep_time":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"missing_items":[]}]}"""

for model in ['qwen/qwen3.6-27b', 'openai/gpt-oss-120b']:
    print(f"\n=== {model} ===")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=1500
        )
        content = response.choices[0].message.content or ""
        finish = response.choices[0].finish_reason
        print(f"Finish: {finish}, Length: {len(content)}")
        # Try parse
        text = content.strip()
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            data = json.loads(text[start:end+1])
            print(f"JSON OK! Ideas: {len(data.get('ideas', []))}")
        else:
            print(f"No JSON braces found. First 100: {repr(text[:100])}")
    except Exception as e:
        print(f"ERROR: {e}")
