with open(r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\inventory.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    print(lines[380].strip())
    for c in lines[380].strip():
        if ord(c) > 127:
            print(f"Unicode: U+{ord(c):04X}")