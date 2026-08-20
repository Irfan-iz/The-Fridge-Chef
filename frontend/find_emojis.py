with open(r'C:\Users\irfan\OneDrive\Desktop\project\frontend\pages\dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

emojis = set(c for c in content if ord(c) > 0x2000)
for e in emojis:
    print(f"Unicode: U+{ord(e):04X}")