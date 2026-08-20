import re

file_path = r'C:\Users\irfan\OneDrive\Desktop\project\backend\routers\recipe.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write a python script to replace the generate_content calls with a retry loop.
# Actually it's easier to manually review the file and inject it.