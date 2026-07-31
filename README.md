# 🍳 The Fridge Chef — Web Version

An AI-powered Malaysian culinary assistant. Scan ingredients with your camera, get halal-friendly recipe ideas within budget, and export shopping lists to WhatsApp.

---

## 📁 Project Structure

```
fridge_chef/
├── backend/
│   ├── main.py                        # FastAPI app (all routes)
│   ├── database.py                    # SQLite database logic
│   ├── requirements.txt               # Python dependencies
│   └── culinary_assistant_model.tflite  # Your CNN model
├── frontend/
│   ├── index.html                     # Login & Register page
│   ├── pages/
│   │   ├── dashboard.html             # Main app (Fridge + Meal Planner)
│   │   └── admin.html                 # Admin dashboard
│   ├── css/
│   │   └── style.css                  # All styles (light + dark mode)
│   └── js/
│       ├── auth.js                    # Shared utilities (toast, loading)
│       ├── inventory.js               # Camera, upload, Gemini scan, fridge
│       ├── meal_planner.js            # Recipe cards + full recipe view
│       └── admin.js                   # Admin charts + user table
```

---

## ⚙️ Setup & Run

### 1. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

> Python 3.10+ recommended.

### 2. Place your model

Make sure `culinary_assistant_model.tflite` is inside the `backend/` folder.

### 3. Set your Gemini API Key

Open `backend/main.py` and replace the key on line:
```python
GEMINI_API_KEY = "your-gemini-api-key-here"
```
> ⚠️ For production, move this to an environment variable:
> ```python
> import os
> GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
> ```

### 4. Start the server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 5. Open the app

Visit: **http://localhost:8000**

---

## 🔐 Default Admin Login

| Field    | Value       |
|----------|-------------|
| Username | `Admin`     |
| Password | `Admin@1234`|

---

## ✨ Features

| Feature | Description |
|---|---|
| 📷 Camera Scan | Use your webcam to identify ingredients via CNN |
| 📁 Upload Scan | Upload an ingredient photo for CNN identification |
| ☁️ Gemini Bulk Scan | Upload a fridge/receipt photo — Gemini detects all items |
| ✏️ Manual Add | Pick ingredients from a dropdown list |
| 🍽️ Recipe Ideas | Gemini generates 3 swipeable recipe cards based on fridge |
| 📊 Full Recipe | Step-by-step guide with cost breakdown + macros |
| 📲 WhatsApp Export | One-tap export of shopping list to WhatsApp |
| 🌙 Dark/Light Mode | Persistent theme toggle |
| ⚙️ Admin Panel | User stats, KPIs, health charts, recipe history |

---

## 🛡️ Security & Privacy

**Password Encryption (Hashing):**
User passwords are **never** stored as plain text. The application utilizes the **SHA-256 cryptographic hashing algorithm** via Python's built-in `hashlib` library. When a user registers, their password is immediately converted into a 64-character hexadecimal signature before being committed to the SQLite database. During login, the entered password is encrypted using the exact same algorithm and matched against the database signature, ensuring complete data privacy and protection against database leaks.

---

## 🔧 Changing the Gemini API Key Safely

Create a `.env` file in `backend/`:
```
GEMINI_API_KEY=your-key-here
```

Install `python-dotenv`:
```bash
pip install python-dotenv
```

Add to top of `main.py`:
```python
from dotenv import load_dotenv
load_dotenv()
import os
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Plain HTML + CSS + Vanilla JS |
| Backend | Python FastAPI |
| AI Vision | TensorFlow Lite (CNN) + Google Gemini 2.5 Flash |
| Database | SQLite |
| Styling | CSS Variables (full dark/light mode) |
