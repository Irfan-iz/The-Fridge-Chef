import os

replacements = {
    # Calendar & General
    '📅': '<i class=\"fa-regular fa-calendar-days\"></i>',
    '🗓️': '<i class=\"fa-regular fa-calendar-days\"></i>',
    '📖': '<i class=\"fa-solid fa-book-open\"></i>',
    '🛒': '<i class=\"fa-solid fa-cart-shopping\"></i>',
    '⚙️': '<i class=\"fa-solid fa-gear\"></i>',
    
    # Meals
    '🍳': '<i class=\"fa-solid fa-mug-hot\"></i>',
    '🥗': '<i class=\"fa-solid fa-bowl-food\"></i>',
    '🍲': '<i class=\"fa-solid fa-utensils\"></i>',
    
    # Macros & Details
    '🔥': '<i class=\"fa-solid fa-fire\"></i>',
    '💰': '<i class=\"fa-solid fa-sack-dollar\"></i>',
    '⏱️': '<i class=\"fa-regular fa-clock\"></i>',
    '💪': '<i class=\"fa-solid fa-drumstick-bite\"></i>',
    '🌾': '<i class=\"fa-solid fa-wheat-awn\"></i>',
    '🥑': '<i class=\"fa-solid fa-droplet\"></i>',
    
    # Actions & Buttons
    '✨': '<i class=\"fa-solid fa-wand-magic-sparkles\"></i>',
    '✏️': '<i class=\"fa-solid fa-pen\"></i>',
    '🗑️': '<i class=\"fa-solid fa-trash\"></i>',
    '➕': '<i class=\"fa-solid fa-plus\"></i>',
    '✅': '<i class=\"fa-solid fa-check\"></i>',
    '❌': '<i class=\"fa-solid fa-xmark\"></i>',
    '🤖': '<i class=\"fa-solid fa-robot\"></i>',
    'ℹ️': '<i class=\"fa-solid fa-circle-info\"></i>',
    '🔍': '<i class=\"fa-solid fa-magnifying-glass\"></i>',
    '🌟': '<i class=\"fa-solid fa-star\"></i>',
    '🎉': '<i class=\"fa-solid fa-party-horn\"></i>'
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
    frontend_dir = r"C:\Users\irfan\OneDrive\Desktop\project\frontend"
    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith('.html') or file.endswith('.js'):
                replace_emojis_in_file(os.path.join(root, file))