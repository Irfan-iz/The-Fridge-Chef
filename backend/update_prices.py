import pandas as pd

def generate_new_prices():
    print("Loading datasets... (This might take a few seconds)")
    
    # 1. Load the CSV files
    prices_df = pd.read_csv('data/pricecatcher.csv')
    lookup_df = pd.read_csv('data/lookup_item.csv')
    
    # 2. Merge them together using 'item_code'
    merged_df = pd.merge(prices_df, lookup_df, on='item_code', how='inner')
    
    # 3. Create a mapping of DOSM's exact Malay names to your app's variables
    # You can expand this list by looking inside the lookup_item.csv file!
    item_mapping = {
        'AYAM BERSIH - STANDARD': 'chicken_standard',
        'DAGING LEMBU IMPORT': 'beef_imported',
        'TELUR AYAM GRED A': 'egg_grade_a',
        'KOBIS BULAT IMPORT (INDONESIA)': 'cabbage_round',
        'LOBAK MERAH': 'carrot',
        'TOMATO': 'tomato',
        'UBI KENTANG IMPORT (CHINA)': 'potato',
        'BAWANG MERAH KECIL (INDIA)': 'onion',
        'BAWANG PUTIH (CHINA)': 'garlic',
        'HALIA TUA IMPORT': 'ginger',
        'CILI MERAH KULAI': 'chili_fresh',
        'KANGKUNG': 'kangkung',
        'TAHU': 'tofu_firm',
        'TEMPE': 'tempeh',
        'IKAN BILIS KUPAS': 'anchovies',
        'KELAPA PARUT': 'coconut_fresh',
        'SERAI': 'lemongrass',
        'LIMAU NIPIS': 'lime',
        'KACANG PANJANG': 'long_beans'
    }
    
    # 4. Filter the dataset to only include the items we care about
    filtered_df = merged_df[merged_df['item'].isin(item_mapping.keys())]
    
    # 5. Calculate the average price for each item
    average_prices = filtered_df.groupby('item')['price'].mean().reset_index()
    
    # 6. Format it into the dictionary structure used in main.py
    new_dosm_prices = {}
    for index, row in average_prices.iterrows():
        malay_name = row['item']
        app_variable_name = item_mapping[malay_name]
        avg_price = round(row['price'], 2)
        new_dosm_prices[app_variable_name] = avg_price
        
    print("\n✅ Processing Complete! Copy the dictionary below into your main.py file:\n")
    print("DOSM_PRICES =", new_dosm_prices)

if __name__ == "__main__":
    generate_new_prices()