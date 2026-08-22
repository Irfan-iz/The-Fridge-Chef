import requests
from bs4 import BeautifulSoup
import re
import urllib.parse

def get_image(query):
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query + ' food')}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    res = requests.get(url, headers=headers)
    
    # Actually DDG HTML doesn't show images easily. Let's use Wikipedia.
    wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles={urllib.parse.quote(query)}"
    wiki_res = requests.get(wiki_url, headers=headers).json()
    try:
        pages = wiki_res['query']['pages']
        for page_id in pages:
            if 'original' in pages[page_id]:
                return pages[page_id]['original']['source']
    except Exception as e:
        return str(e)
    return "Not found"

print(get_image("Nasi lemak"))