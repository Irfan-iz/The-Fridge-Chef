import re

files_to_fix = [
    r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\admin.js',
    r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\profile.js',
    r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\weekly_planner.js',
    r'C:\Users\irfan\OneDrive\Desktop\project\frontend\js\pipeline_progress.js'
]

for filepath in files_to_fix:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace .textContent = '<i ...' with .innerHTML = '<i ...'
    # Use a regex that matches .textContent = ... where the RHS contains '<i '
    
    # Actually, simpler to just replace specific known lines
    
    # admin.js
    content = content.replace("trendEl.textContent = <i class=\"fa-solid fa-bolt\"></i>", "trendEl.innerHTML = <i class=\"fa-solid fa-bolt\"></i>")
    content = content.replace("btn.textContent = '<i class=\"fa-solid fa-trash\"></i>", "btn.innerHTML = '<i class=\"fa-solid fa-trash\"></i>")
    content = content.replace("btn.textContent = '<i class=\"fa-solid fa-key\"></i>", "btn.innerHTML = '<i class=\"fa-solid fa-key\"></i>")
    
    # profile.js
    content = content.replace("btn.textContent = '<i class=\"fa-solid fa-floppy-disk\"></i>", "btn.innerHTML = '<i class=\"fa-solid fa-floppy-disk\"></i>")
    
    # weekly_planner.js
    content = content.replace("genBtn.textContent = <i class=\"fa-solid fa-brain\"></i>", "genBtn.innerHTML = <i class=\"fa-solid fa-brain\"></i>")
    
    # pipeline_progress.js
    content = content.replace("badge.textContent = <i class=\"fa-regular fa-clock\"></i>", "badge.innerHTML = <i class=\"fa-regular fa-clock\"></i>")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed {filepath}")