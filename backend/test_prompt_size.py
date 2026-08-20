import os, sys, json
sys.path.append('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend')
from dotenv import load_dotenv
load_dotenv('C:\\Users\\irfan\\OneDrive\\Desktop\\project\\backend\\.env')
import dosm_pipeline
from groq import Groq

client = Groq()

# Simulate what the prompt looks like
ingredients = ['Rice', 'Chicken', 'Egg']
user_keywords = [i.lower() for i in ingredients]
all_prices = dosm_pipeline.get_price_summary_for_prompt()
filtered = []
for line in all_prices.split('\n'):
    ll = line.lower()
    if any(kw in ll for kw in user_keywords) or any(s in ll for s in ['oil','salt','soy sauce','pepper']):
        if line not in filtered:
            filtered.append(line)

live_prices = '\n'.join(filtered[:12])
print(f"Filtered prices ({len(filtered[:12])} lines):\n{live_prices}\n")
print(f"Price string token estimate: ~{len(live_prices)//4} tokens")

prompt = f"""Malaysian AI chef. Generate 5 recipe ideas as JSON.

Ingredients: {ingredients}
Budget: RM5-15 | Calories: any | Prep: any | Halal: True | Cuisine: any | Meal: any
Rule: FLEXIBLE: up to 3 extra pantry staples, list in missing_items
DOSM prices (per retail unit): {live_prices}
Pricing: use actual quantity cost, not full unit price. Condiments <RM0.20 total.

Output JSON only: {{"ideas":[{{"name":"","description":"","tags":"","est_cost_rm":0.0,"prep_time":0,"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"missing_items":[]}}]}}"""

print(f"\nFull prompt char length: {len(prompt)}")
print(f"Full prompt token estimate: ~{len(prompt)//4}")

# Try sending it
try:
    response = client.chat.completions.create(
        model='groq/compound',
        messages=[
            {'role': 'system', 'content': 'Output ONLY valid JSON.'},
            {'role': 'user', 'content': prompt}
        ]
    )
    print(f"\nSUCCESS! Got {len(response.choices[0].message.content)} chars back")
except Exception as e:
    print(f"\nFAILED: {e}")
    # Try without system message
    try:
        response = client.chat.completions.create(
            model='groq/compound',
            messages=[{'role': 'user', 'content': 'Output ONLY JSON. ' + prompt}]
        )
        print(f"No-system-msg SUCCESS! Got {len(response.choices[0].message.content)} chars back")
    except Exception as e2:
        print(f"No-system-msg also FAILED: {e2}")
