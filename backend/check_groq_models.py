import os, sys
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
models = client.models.list()

llama_models = [m.id for m in models.data if 'llama' in m.id.lower()]
print("Available Llama models on your Groq account:")
for m in sorted(llama_models):
    print(f"- {m}")
