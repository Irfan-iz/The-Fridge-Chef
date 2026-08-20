filepath = r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\inventory.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("btn.textContent = 'Added \u2713'", "btn.innerHTML = 'Added <i class=\"fa-solid fa-check\"></i>'")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed inventory.js")