import os, sys
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq
client = Groq()
prompt = "Output valid JSON with a root key 'ideas'. Each idea has 'title'."
response = client.chat.completions.create(model='openai/gpt-oss-20b', messages=[{'role': 'system', 'content': 'You are an API that outputs ONLY valid JSON. No markdown.'}, {'role': 'user', 'content': prompt}])
print("RAW:")
print(repr(response.choices[0].message.content))
