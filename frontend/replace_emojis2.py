import os

replacements = {
    '💾': '<i class=\"fa-solid fa-floppy-disk\"></i>',
    '🚪': '<i class=\"fa-solid fa-door-open\"></i>',
    '🌅': '<i class=\"fa-solid fa-sun\"></i>',
    '📊': '<i class=\"fa-solid fa-chart-bar\"></i>',
    '⚠️': '<i class=\"fa-solid fa-triangle-exclamation\"></i>',
    '📸': '<i class=\"fa-solid fa-camera\"></i>',
    '🎯': '<i class=\"fa-solid fa-bullseye\"></i>',
    '🧠': '<i class=\"fa-solid fa-brain\"></i>',
    '🍽️': '<i class=\"fa-solid fa-utensils\"></i>',
    '🍽': '<i class=\"fa-solid fa-utensils\"></i>',
    '📥': '<i class=\"fa-solid fa-inbox\"></i>',
    '😋': '<i class=\"fa-solid fa-face-smile-beam\"></i>',
    '🏃': '<i class=\"fa-solid fa-person-running\"></i>',
    '👨': '<i class=\"fa-solid fa-user\"></i>',
    '⚡': '<i class=\"fa-solid fa-bolt\"></i>',
    '☰': '<i class=\"fa-solid fa-bars\"></i>',
    '💡': '<i class=\"fa-solid fa-lightbulb\"></i>',
    '📲': '<i class=\"fa-solid fa-mobile-screen\"></i>',
    '🔄': '<i class=\"fa-solid fa-rotate\"></i>',
    '🔑': '<i class=\"fa-solid fa-key\"></i>',
    '📌': '<i class=\"fa-solid fa-thumbtack\"></i>',
    '📋': '<i class=\"fa-solid fa-clipboard-list\"></i>',
    '📜': '<i class=\"fa-solid fa-scroll\"></i>',
    '🌙': '<i class=\"fa-solid fa-moon\"></i>',
    '📷': '<i class=\"fa-solid fa-camera\"></i>',
    '❤️': '<i class=\"fa-solid fa-heart\"></i>',
    '☀️': '<i class=\"fa-solid fa-sun\"></i>',
    '➡️': '<i class=\"fa-solid fa-arrow-right\"></i>',
    '⬅️': '<i class=\"fa-solid fa-arrow-left\"></i>'
}

def replace_emojis_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        for emoji, fa_icon in replacements.items():
            content = content.replace(emoji, fa_icon)
            
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
    except Exception as e:
        print(f"Failed to process {filepath}: {e}")

if __name__ == '__main__':
    frontend_dir = r'C:\Users\irfan\OneDrive\Desktop\project\frontend'
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html') or file.endswith('.js'):
                replace_emojis_in_file(os.path.join(root, file))