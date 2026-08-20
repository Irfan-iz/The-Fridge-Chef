import os
frontend_dir = r'C:\Users\irfan\OneDrive\Desktop\project\frontend'
for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if '\u2713' in content or '\u2715' in content:
                print(f"Found check/cross in {filepath}")
                content = content.replace('\u2713', '<i class="fa-solid fa-check"></i>')
                content = content.replace('\u2715', '<i class="fa-solid fa-xmark"></i>')
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)