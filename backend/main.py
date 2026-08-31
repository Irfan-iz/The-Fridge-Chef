import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import database as db

# Import routers
from routers import auth, scan, recipe, mealplan, shopping, admin

# ==========================================
# APP SETUP
# ==========================================
app = FastAPI(title="Fridge Chef API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
db.init_db()

# Mount Frontend Static Files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# ==========================================
# INCLUDE ROUTERS
# ==========================================
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(recipe.router)
app.include_router(mealplan.router)
app.include_router(shopping.router)
app.include_router(admin.router)

# ==========================================
# HTML PAGE ROUTES
# ==========================================
@app.get("/")
def serve_login():
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/dashboard")
def serve_dashboard():
    return FileResponse(os.path.join(frontend_path, "pages", "dashboard.html"))

@app.get("/admin")
def serve_admin():
    return FileResponse(os.path.join(frontend_path, "pages", "admin.html"))

@app.get("/privacy.html")
def serve_privacy():
    return FileResponse(os.path.join(frontend_path, "pages", "privacy.html"))

@app.get("/terms.html")
def serve_terms():
    return FileResponse(os.path.join(frontend_path, "pages", "terms.html"))


@app.get("/manifest.json")
def serve_manifest():
    return FileResponse(os.path.join(frontend_path, "manifest.json"))

@app.get("/service-worker.js")
def serve_sw():
    return FileResponse(os.path.join(frontend_path, "service-worker.js"))