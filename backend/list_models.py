import os, sys
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
from groq import Groq

client = Groq()
models = client.models.list().data
models.sort(key=lambda m: m.id)

print("=== ALL AVAILABLE GROQ MODELS ===")
for m in models:
    print(m.id)

# Try to find llama models specifically
print("\n=== LLAMA MODELS ONLY ===")
for m in models:
    if 'llama' in m.id.lower():
        print(m.id)
