import requests
import urllib.parse
import json

foods = [
    "Nasi lemak", "Nasi goreng", "Rendang", "Curry", "Laksa", 
    "Omelette", "Fried rice", "Fried chicken", "Stir fry", 
    "Salad", "Soup", "Noodle", "Satay", "Roti canai", "Beef"
]

results = []
headers = {'User-Agent': 'Mozilla/5.0'}

for f in foods:
    wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={urllib.parse.quote(f)}"
    try:
        res = requests.get(wiki_url, headers=headers).json()
        pages = res['query']['pages']
        for p in pages:
            if 'original' in pages[p]:
                results.append(f"{{ keywords: ['{f.lower()}'], url: '{pages[p]['original']['source']}' }}")
                break
    except:
        pass

print(',\n  '.join(results))