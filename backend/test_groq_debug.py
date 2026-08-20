import os, sys, json
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq

client = Groq()

prompt = """You are a Malaysian recipe generator API. Output only valid JSON.

Return a JSON object with this structure:
{
  "ideas": [
    {
      "name": "Recipe Name",
      "calories": 400,
      "est_cost_rm": 5.00,
      "prep_time": 20,
      "ingredients_used": ["chicken", "rice"],
      "description": "Short description"
    }
  ]
}

Generate 3 recipe ideas using: chicken, rice, eggs"""

response = client.chat.completions.create(
    model='openai/gpt-oss-20b',
    messages=[
        {'role': 'system', 'content': 'You are an API that outputs ONLY valid JSON. No markdown.'},
        {'role': 'user', 'content': prompt}
    ]
)

content = response.choices[0].message.content
print("=== RAW RESPONSE ===")
print(repr(content))
print("\n=== LENGTH:", len(content))
print("\n=== FIRST 200 CHARS ===")
print(repr(content[:200]))
