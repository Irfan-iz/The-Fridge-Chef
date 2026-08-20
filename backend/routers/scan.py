import io
import numpy as np
from PIL import Image
from fastapi import APIRouter, HTTPException, UploadFile, File
from config import CLASS_NAMES, logger
from ai_models import interpreter, input_details, output_details, gemini_model

router = APIRouter()

def preprocess_image(image):
    input_shape = input_details[0]['shape']
    h, w = input_shape[1], input_shape[2]
    img = image.resize((w, h))
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)

@router.post("/api/scan/cnn")
async def scan_cnn(file: UploadFile = File(...)):
    if interpreter is None:
        raise HTTPException(status_code=503, detail="CNN model not available.")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    input_data = preprocess_image(image)
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])
    idx = int(np.argmax(output_data[0]))
    confidence = float(output_data[0][idx])
    name = CLASS_NAMES[idx]
    return {"ingredient": name, "confidence": round(confidence * 100, 1)}

@router.post("/api/scan/gemini")
async def scan_gemini(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        prompt = "Identify all the raw vegetables, fruits, meats, or proteins in this image. Return ONLY a comma-separated list of capitalized words (e.g., Cabbage, Carrot, Chicken). Do not use quotes, bullet points, or sentences."
        response = gemini_model.generate_content([prompt, image])
            
        response_text = (getattr(response, 'text', '') or '').strip()
        if not response_text:
            return {"items": []}
        items = []
        for item in response_text.split(','):
            cleaned = item.strip().replace('"','').replace("'",'').replace('\n','').strip()
            if cleaned:
                items.append(cleaned.title())
        return {"items": items}
    except Exception as e:
        logger.error(f"Gemini scan error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during image scanning. Please try again.")
