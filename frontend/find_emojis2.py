import os
frontend_dir = r'C:\Users\irfan\OneDrive\Desktop\project\frontend'
emojis = set()
for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                for c in content:
                    if ord(c) > 0x2000 and ord(c) not in [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0xFE0F]:
                        emojis.add(c)

for e in emojis:
    print(f"Unicode: U+{ord(e):04X}")