from pyngrok import ngrok
import time

try:
    public_url = ngrok.connect(8000)
    print("SUCCESS: " + public_url.public_url)
    while True:
        time.sleep(10)
except Exception as e:
    print(f"ERROR: {e}")