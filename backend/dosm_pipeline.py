"""
OpenDOSM Price Pipeline
Loads real Malaysian market prices from local CSV dataset files.
Source: data.gov.my / OpenDOSM PriceCatcher dataset
"""
import csv
import statistics
import os
from collections import defaultdict
from functools import lru_cache

BASE_DIR    = os.path.dirname(__file__)
LOOKUP_FILE = os.path.join(BASE_DIR, "data", "lookup_item.csv")
PRICES_FILE = os.path.join(BASE_DIR, "data", "pricecatcher.csv")

# ==========================================
# ENGLISH NAME MAPPING  (Malay → English)
# ==========================================
ENGLISH_NAMES = {
    "AYAM BERSIH - STANDARD":                          "Chicken (Standard)",
    "AYAM BERSIH - SUPER":                             "Chicken (Super)",
    "AYAM HIDUP":                                      "Live Chicken",
    "PAHA AYAM (CHICKEN DRUMSTICK)":                   "Chicken Drumstick",
    "DADA AYAM (CHICKEN KEEL) (1KG)":                  "Chicken Breast",
    "THIGH AYAM":                                      "Chicken Thigh",
    "WHOLE LEG AYAM":                                  "Chicken Whole Leg",
    "KEPAK AYAM (CHICKEN WING) (1KG)":                 "Chicken Wing",
    "DAGING LEMBU IMPORT (TOPSIDE)":                   "Beef (Imported)",
    "DAGING LEMBU TEMPATAN (BAHAGIAN 1 DAGING PAHA (KECUALI BATANG PINANG - TENDERLOIN)": "Beef (Local)",
    "DAGING KAMBING BEBIRI IMPORT BERTULANG (MUTTON) (AUSTRALIA - KOTAK)": "Mutton",
    "DAGING KERBAU IMPORT (INDIA) * (TOP SIDE)":       "Buffalo Meat",
    "IKAN KEMBUNG (ANTARA 8 HINGGA 12 EKOR SEKILOGRAM)": "Kembung Fish",
    "IKAN MERAH (KEPINGAN)":                           "Red Snapper",
    "IKAN BAWAL HITAM (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM)": "Black Pomfret",
    "IKAN CENCARU (ANTARA 4 HINGGA 6 EKOR SEKILOGRAM)": "Cencaru Fish",
    "IKAN SELAR KUNING (B\t% 11 EKOR SEKILOGRAM)":     "Yellow Stripe Scad",
    "IKAN TENGGIRI BATANG (KEPINGAN)":                 "Spanish Mackerel",
    "IKAN TILAPIA MERAH (ANTARA 2 HINGGA 5 EKOR SEKILOGRAM)": "Tilapia",
    "IKAN SIAKAP (ANTARA 2 HINGGA 4 EKOR SEKILOGRAM)": "Sea Bass",
    "UDANG HARIMAU (ANTARA 20 HINGGA 30 EKOR SEKILOGRAM)": "Tiger Prawns",
    "UDANG PUTIH KECIL (B\t% 61 EKOR SEKILOGRAM)":    "White Prawns (Small)",
    "SOTONG (\u2265 6 EKOR SEKILOGRAM)":               "Squid",
    "KETAM RENJONG/BUNGA (ANTARA 5 HINGGA 8 EKOR SEKILOGRAM)": "Crab",
    "TELUR AYAM GRED A":                               "Eggs Grade A (10pcs)",
    "TELUR AYAM GRED B":                               "Eggs Grade B (10pcs)",
    "TELUR AYAM GRED C":                               "Eggs Grade C (10pcs)",
    "TELUR AYAM GRED A (BERAT 65.0 GM HINGGA 69.9 GM SEBIJI)": "Eggs Grade A (10pcs)",
    "TELUR AYAM GRED B (BERAT 60.0 GM HINGGA 64.9 GM)": "Eggs Grade B (10pcs)",
    "TELUR AYAM GRED C (BERAT 55.0 GM HINGGA 59.9 GM SEBIJI)": "Eggs Grade C (10pcs)",
    "KUBIS BULAT IMPORT (CHINA)":                      "Cabbage (Imported)",
    "KUBIS BULAT (TEMPATAN)":                          "Cabbage (Local)",
    "LOBAK MERAH":                                     "Carrot",
    "TIMUN":                                           "Cucumber",
    "TOMATO":                                          "Tomato",
    "BAWANG BESAR IMPORT (INDIA)":                     "Onion (Imported)",
    "BAWANG BESAR IMPORT (CHINA)":                     "Onion (Imported)",
    "BAWANG BESAR KUNING/HOLLAND":                     "Onion (Holland)",
    "BAWANG KECIL MERAH BIASA IMPORT (INDIA)":         "Shallots",
    "BAWANG PUTIH IMPORT (CHINA)":                     "Garlic (Imported)",
    "HALIA BASAH (TUA)":                               "Ginger",
    "LADA BENGGALA HIJAU (CAPSICUM)":                  "Bell Pepper (Green)",
    "LADA BENGGALA MERAH (CAPSICUM)":                  "Bell Pepper (Red)",
    "LADA BENGGALA KUNING (CAPSICUM)":                 "Bell Pepper (Yellow)",
    "KANGKUNG":                                        "Water Spinach (Kangkung)",
    "BAYAM HIJAU":                                     "Spinach",
    "KAILAN":                                          "Chinese Kale (Kailan)",
    "SAWI HIJAU":                                      "Mustard Greens",
    "KACANG PANJANG":                                  "Long Beans",
    "TERUNG BULAT":                                    "Eggplant / Brinjal",
    "KACANG BENDI":                                    "Okra",
    "DAUN BAWANG":                                     "Spring Onion",
    "CILI MERAH - KULAI":                              "Red Chili",
    "CILI HIJAU":                                      "Green Chili",
    "CILI API/PADI HIJAU":                             "Bird's Eye Chili",
    "CILI KERING KERINTING (BERTANGKAI/TIDAK BERTANGKAI)": "Dried Chili",
    "KUNYIT HIDUP":                                    "Fresh Turmeric",
    "LENGKUAS":                                        "Galangal",
    "UBI KENTANG IMPORT (CHINA)":                      "Potato (Imported)",
    "UBI KENTANG HOLLAND":                             "Potato (Holland)",
    "BETIK BIASA":                                     "Papaya",
    "TEMBIKAI MERAH BERBIJI":                          "Watermelon",
    "DRAGON FRUIT MERAH":                              "Red Dragon Fruit",
    "NENAS BIASA (JOSAPINE/MORRIS/SARAWAK)":           "Pineapple",
    "LIMAU NIPIS":                                     "Lime",
    "LIMAU KASTURI":                                   "Calamansi Lime",
    "JAMBU BATU BERBIJI":                              "Guava",
    "PISANG BERANGAN":                                 "Berangan Banana",
    "KELAPA BIJI":                                     "Coconut (whole)",
    "KELAPA PARUT":                                    "Grated Coconut",
    "SANTAN KELAPA SEGAR (BIASA)":                     "Fresh Coconut Milk",
    "SANTAN KELAPA JENAMA KARA":                       "Coconut Milk (Kara)",
    "BERAS SUPER CAP RAMBUTAN 5% (IMPORT)":            "White Rice (Imported)",
    "BERAS CAP JATI (SST5%)":                          "White Rice (Local)",
    "TEPUNG GANDUM NGP (BERBUNGKUS, CAP SAUH)":        "Wheat Flour",
    "MINYAK MASAK TULEN CAP BURUH":                    "Cooking Oil (Buruh)",
    "MINYAK MASAK TULEN CAP SERI MURNI":               "Cooking Oil (Seri Murni)",
    "MINYAK MASAK SEBATIAN CAP HELANG":                "Cooking Oil (Helang)",
    "MINYAK MASAK PAKET (PELBAGAI JENAMA)":            "Cooking Oil Sachet",
    "GULA PUTIH BERTAPIS HALUS (PELBAGAI JENAMA)":     "White Sugar",
    "GULA PUTIH BERTAPIS KASAR (PELBAGAI JENAMA)":     "White Sugar (Coarse)",
    "GULA MERAH LEMBUT (PELBAGAI JENAMA)":             "Brown Sugar",
    "GARAM HALUS BIASA (PELBAGAI JENAMA)":             "Salt",
    "KICAP MANIS ADABI":                               "Sweet Soy Sauce",
    "KICAP LEMAK MANIS CAP KIPAS UDANG":               "Soy Sauce",
    "SOS CILI MAGGI":                                  "Chili Sauce",
    "SOS TOMATO MAGGI":                                "Tomato Sauce",
    "SOS TIRAM MAGGI":                                 "Oyster Sauce",
    "LADA HITAM":                                      "Black Pepper",
    "LADA PUTIH":                                      "White Pepper",
    "SERBUK KARI IKAN BABAS":                          "Fish Curry Powder",
    "SERBUK KARI AYAM DAN DAGING ADABI":               "Chicken Curry Powder",
    "SERBUK CILI BABAS":                               "Chili Powder",
    "SERBUK KUNYIT CAMPURAN (SEBATIAN) ADABI":         "Turmeric Powder",
    "KACANG TANAH (IMPORT)":                           "Peanuts",
    "MEE KUNING BASAH (PELBAGAI JENAMA)":              "Fresh Yellow Noodles",
    "BIHUN KERING IMPORT (CAP BINTANG)":               "Rice Vermicelli",
    "ASAM JAWA (TIDAK BERBIJI) ADABI":                 "Tamarind Paste",
    "SUSU SEGAR KURMA FARM FRESH":                     "Fresh Milk",
    "MENTEGA ANCHOR (SALTED)":                         "Butter (Anchor)",
    "MARJERIN PLANTA":                                 "Margarine",
}

# ==========================================
# UNIT SIZE MAP — for per-unit retail items
# Used for Groq prompt: tells AI the retail unit size
# ==========================================
UNIT_SIZES = {
    "Eggs Grade A (10pcs)":   "10 eggs per pack",
    "Eggs Grade B (10pcs)":   "10 eggs per pack",
    "Eggs Grade C (10pcs)":   "10 eggs per pack",
    "Salt":                   "~350g per pack",
    "Black Pepper":           "100g per pack",
    "White Pepper":           "100g per pack",
    "Chili Powder":           "per pack",
    "Turmeric Powder":        "per pack",
    "Fish Curry Powder":      "per pack",
    "Chicken Curry Powder":   "per pack",
    "Butter (Anchor)":        "227g per pack",
    "Cooking Oil (Buruh)":    "per bottle",
    "Cooking Oil (Seri Murni)": "per bottle",
    "Cooking Oil (Helang)":   "per bottle",
    "Cooking Oil Sachet":     "per sachet ~25ml",
    "Coconut (whole)":        "per whole coconut",
    "Grated Coconut":         "per kg",
    "White Rice (Imported)":  "per 10kg bag",
    "White Rice (Local)":     "per 10kg bag",
    "Wheat Flour":            "per kg",
    "Sweet Soy Sauce":        "per bottle",
    "Soy Sauce":              "per bottle",
    "Chili Sauce":            "per bottle",
    "Oyster Sauce":           "per bottle",
    "Tamarind Paste":         "per pack",
}

# ==========================================
# KEYWORD LOOKUP TABLE
# Maps English search keywords → item code(s)
# Prevents wrong fuzzy matching
# ==========================================
KEYWORD_MAP = {
    # Chicken
    "chicken": ["1"],
    "chicken breast": ["1551"],
    "chicken drumstick": ["1550"],
    "chicken wing": ["1804"],
    "chicken thigh": ["1552"],
    # Beef / Meat
    "beef": ["1370"],
    "mutton": ["9"],
    # Fish
    "fish": ["47"],
    "kembung": ["1476"],
    "tilapia": ["1921"],
    "sea bass": ["1437"],
    "snapper": ["64"],
    "mackerel": ["1438"],
    # Seafood
    "prawn": ["849"],
    "squid": ["845"],
    "crab": ["847"],
    # Eggs
    "egg": ["1109"],
    "eggs": ["1109"],
    # Vegetables
    "cabbage": ["104"],
    "carrot": ["109"],
    "cucumber": ["113"],
    "tomato": ["114"],
    "onion": ["1440"],
    "garlic": ["1564"],
    "ginger": ["95"],
    "bell pepper": ["1128"],
    "capsicum": ["1128"],
    "kangkung": ["1559"],
    "spinach": ["1556"],
    "long beans": ["98"],
    "eggplant": ["1923"],
    "brinjal": ["1923"],
    "okra": ["96"],
    "potato": ["1131"],
    "sweet potato": ["861"],
    "broccoli": ["1479"],
    "cauliflower": ["1481"],
    "chili": ["93"],
    "green chili": ["92"],
    "turmeric": ["108"],
    "galangal": ["1819"],
    "lemongrass": ["95"],
    "shallot": ["1442"],
    # Fruits
    "lime": ["1132"],
    "lemon": ["1132"],
    "coconut": ["101"],
    "banana": ["18"],
    "papaya": ["16"],
    "pineapple": ["25"],
    "watermelon": ["20"],
    # Rice & Grains
    "rice": ["904"],
    "flour": ["917"],
    # Oil
    "cooking oil": ["1094"],
    "oil": ["918"],
    # Condiments
    "salt": ["1605"],
    "sugar": ["1590"],
    "brown sugar": ["1588"],
    "soy sauce": ["214"],
    "sweet soy sauce": ["1135"],
    "chili sauce": ["1070"],
    "tomato sauce": ["217"],
    "oyster sauce": ["1138"],
    "black pepper": [],   # No DOSM data — uses fallback price
    "pepper": [],          # Use fallback price
    "curry powder": ["1568"],
    "tamarind": ["1604"],
    "coconut milk": ["1611"],
    "santan": ["1611"],
    # Dairy
    "butter": ["1609"],
    "milk": ["1960"],
    "margarine": ["206"],
    # Noodles
    "noodle": ["1483"],
    "vermicelli": ["1585"],
}

# Fallback hardcoded prices for items not in DOSM data
FALLBACK_PRICES = {
    "black pepper": 0.80,   # 100g pack ~RM 3-4, very small amounts used
    "white pepper": 0.80,
    "pepper": 0.80,
    "soy sauce": 6.80,
    "sesame oil": 8.00,
    "vinegar": 3.50,
    "cornstarch": 2.50,
    "baking powder": 6.50,
    "vanilla extract": 5.00,
    "spring onion": 2.00,
    "pandan": 1.00,
}


# ==========================================
# LOAD & PROCESS DATA
# ==========================================
@lru_cache(maxsize=1)
def load_price_database():
    if not os.path.exists(LOOKUP_FILE) or not os.path.exists(PRICES_FILE):
        print("[WARNING] OpenDOSM CSV files not found in data/ folder.")
        return {}

    # Load item lookup
    items = {}
    with open(LOOKUP_FILE, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            code = row.get('item_code', '').strip()
            name = row.get('item', '').strip()
            if code and name:
                items[code] = {
                    'name_malay': name,
                    'unit':       row.get('unit', '').strip(),
                    'category':   row.get('item_category', '').strip(),
                    'group':      row.get('item_group', '').strip(),
                }

    # Load prices
    prices_by_item = defaultdict(list)
    with open(PRICES_FILE, encoding='utf-8') as f:
        for row in csv.DictReader(f):
            code = row.get('item_code', '').strip()
            try:
                prices_by_item[code].append(float(row['price']))
            except (ValueError, KeyError):
                pass

    # Build final database
    db = {}
    for code, price_list in prices_by_item.items():
        if code not in items:
            continue
        info       = items[code]
        name_malay = info['name_malay']
        name_eng   = ENGLISH_NAMES.get(name_malay.upper().strip(), '')

        db[code] = {
            'item_code':    int(code),
            'name_malay':   name_malay,
            'name_english': name_eng,
            'unit':         info['unit'],
            'category':     info['category'],
            'group':        info['group'],
            'price_median': round(statistics.median(price_list), 2),
            'price_min':    round(min(price_list), 2),
            'price_max':    round(max(price_list), 2),
            'sample_count': len(price_list),
        }

    print(f"[INFO] OpenDOSM loaded: {len(db)} items from {sum(len(v) for v in prices_by_item.values()):,} price records.")
    return db


# ==========================================
# PUBLIC FUNCTIONS
# ==========================================
def get_price(item_name_english: str):
    """
    Look up retail price by English ingredient name.
    Uses keyword map first (exact), then fuzzy fallback.
    Returns median retail price (RM) or None if not found.
    """
    db    = load_price_database()
    query = item_name_english.lower().strip()

    # 1. Keyword map — most reliable
    for keyword, codes in KEYWORD_MAP.items():
        if keyword in query or query in keyword:
            for code in codes:
                if code in db:
                    return db[code]['price_median']

    # 2. Fallback hardcoded prices
    for keyword, price in FALLBACK_PRICES.items():
        if keyword in query:
            return price

    # 3. English name fuzzy match
    for code, info in db.items():
        eng = info['name_english'].lower()
        if eng and (query == eng or query in eng or eng in query):
            return info['price_median']

    return None


def get_all_items() -> list:
    db = load_price_database()
    return sorted(db.values(), key=lambda x: x['category'])


def get_price_summary_for_prompt() -> str:
    """
    Compact price reference for Groq prompts.
    Shows retail unit price AND the unit size clearly.
    """
    db = load_price_database()

    cooking_categories = {
        'AYAM', 'DAGING', 'BAHAN LAUT', 'TELUR', 'SAYUR-SAYURAN',
        'BUAH-BUAHAN', 'BERAS', 'TEPUNG', 'MINYAK DAN LEMAK',
        'KELAPA', 'GULA', 'KICAP DAN SOS', 'MEE/KUETIAU',
        'BIHUN', 'UBI KENTANG', 'BAWANG', 'REMPAH RATUS (TIDAK BERBUNGKUS)',
        'REMPAH RATUS (BERBUNGKUS)', 'MENTEGA', 'SANTAN (KOTAK)'
    }

    # Use keyword map to get the best representative price for each ingredient
    seen    = set()
    lines   = []

    for keyword, codes in KEYWORD_MAP.items():
        for code in codes:
            if code in db and code not in seen:
                info      = db[code]
                if info['category'] not in cooking_categories:
                    continue
                eng_name  = info['name_english'] or info['name_malay']
                unit_hint = UNIT_SIZES.get(eng_name, info['unit'])
                lines.append(
                    f"{eng_name} ({unit_hint}): RM {info['price_median']}"
                )
                seen.add(code)

    # Add fallback items not in DOSM
    lines.append("Black Pepper (100g pack): RM 3.50")
    lines.append("White Pepper (100g pack): RM 3.50")
    lines.append("Soy Sauce (bottle ~340ml): RM 6.80")
    lines.append("Sesame Oil (bottle): RM 8.00")
    lines.append("Oyster Sauce (bottle): RM 5.90")

    return '\n'.join(sorted(set(lines)))