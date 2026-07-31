import os
import shutil
import random
from bing_image_downloader import downloader

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Configure paths
DATASET_DIR = r"c:\Users\irfan\OneDrive\Desktop\project\backend\dataset"
RAW_DIR = os.path.join(DATASET_DIR, "raw_downloads")

# The classes we want to add and their corresponding search queries
CLASSES_TO_ADD = {
    "Tofu": "raw white tofu block",
    "Tempeh": "raw tempeh block",
    "Anchovies": "dried anchovies ikan bilis",
    "Coconut": "fresh whole coconut",
    "Kangkung": "water spinach kangkung leaves",
    "Lime": "fresh green lime",
    "Long_Beans": "raw long beans kacang panjang"
}

IMAGES_PER_CLASS = 30 # Download 30, we'll split them 70/20/10

def main():
    print("Starting download process...")
    for class_name, query in CLASSES_TO_ADD.items():
        print(f"\n--- Downloading for {class_name} ({query}) ---")
        downloader.download(
            query,
            limit=IMAGES_PER_CLASS,
            output_dir=RAW_DIR,
            adult_filter_off=False,
            force_replace=False,
            timeout=10
        )
        
        # Move and split the images into train/valid/test
        query_dir = os.path.join(RAW_DIR, query)
        if not os.path.exists(query_dir):
            print(f"Warning: No images downloaded for {class_name}")
            continue
            
        images = [f for f in os.listdir(query_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        random.shuffle(images)
        
        # Calculate splits
        n = len(images)
        train_end = int(n * 0.7)
        valid_end = int(n * 0.9)
        
        splits = {
            "train": images[:train_end],
            "valid": images[train_end:valid_end],
            "test": images[valid_end:]
        }
        
        for split_name, split_images in splits.items():
            dest_dir = os.path.join(DATASET_DIR, split_name, class_name)
            os.makedirs(dest_dir, exist_ok=True)
            
            for img in split_images:
                src = os.path.join(query_dir, img)
                dst = os.path.join(dest_dir, img)
                try:
                    shutil.copy2(src, dst)
                except Exception as e:
                    print(f"Error copying {img}: {e}")
                    
        print(f"Successfully processed {class_name}: {len(splits['train'])} train, {len(splits['valid'])} valid, {len(splits['test'])} test.")

    print("\nCleaning up raw downloads...")
    try:
        shutil.rmtree(RAW_DIR)
    except Exception as e:
        print(f"Could not remove raw dir: {e}")
        
    print("Dataset expansion complete!")

if __name__ == "__main__":
    main()
