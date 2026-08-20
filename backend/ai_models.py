import google.generativeai as genai
from groq import Groq
from config import GEMINI_API_KEY, GROQ_API_KEY, MODEL_PATH, logger

# Initialize Gemini models
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-3.6-flash')      # vision model (scan)
text_model   = genai.GenerativeModel('gemini-3.5-flash-lite') # text generation (recipes)

# Initialize Groq (still here if needed in future)
groq_client = Groq(api_key=GROQ_API_KEY)

# Initialize TFLite model
interpreter = None
input_details = None
output_details = None
try:
    import tensorflow as tf
    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    interpreter.allocate_tensors()
    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    logger.info("TFLite model loaded successfully.")
except Exception as e:
    logger.warning(f"TFLite not loaded: {e}")
