import re
from fastapi import APIRouter, HTTPException, Depends
from schemas import LoginRequest, RegisterRequest, UpdateProfileRequest
import database as db
from security import create_access_token, get_current_user

router = APIRouter()

def check_password_strength(password):
    if len(password) < 8: return False, "Password must be at least 8 characters."
    if not re.search(r"[a-z]", password): return False, "Must contain a lowercase letter."
    if not re.search(r"[A-Z]", password): return False, "Must contain an uppercase letter."
    if not re.search(r"\d", password): return False, "Must contain a number."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password): return False, "Must contain a special character."
    return True, "OK"

@router.post("/api/login")
def login(req: LoginRequest):
    user = db.login_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    
    # Create JWT token
    is_admin = user["username"] == "Admin"
    access_token = create_access_token({
        "sub": user["username"],
        "user_id": user["id"],
        "is_admin": is_admin
    })
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["id"],
        "username": user["username"],
        "phone_number": user.get("phone_number", ""),
        "age": user.get("age", 25),
        "gender": user.get("gender", "Male"),
        "height": user.get("height", 170),
        "weight": user.get("weight", 65),
        "activity_level": user.get("activity_level", "Sedentary (Little to no exercise)"),
        "bmi": user.get("bmi", 22.5),
        "health_goal": user.get("health_goal", "Maintain Current Weight"),
        "allergies": user.get("allergies", ""),
        "is_admin": is_admin
    }

@router.post("/api/register")
def register(req: RegisterRequest):
    ok, msg = check_password_strength(req.password)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    h = req.height / 100
    bmi = round(req.weight / (h * h), 1)
    success = db.add_user(req.username, req.password, req.phone_number, req.age, req.gender,
                          req.height, req.weight, req.activity_level, bmi, req.health_goal, req.allergies)
    if not success:
        raise HTTPException(status_code=409, detail="Username already taken.")
    return {"success": True, "bmi": bmi}

@router.post("/api/profile/update")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    # Ensure users can only update their own profile
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only update your own profile.")
    h = req.height / 100
    bmi = round(req.weight / (h * h), 1)
    db.update_user_profile(req.username, req.phone_number, req.age, req.gender,
                           req.height, req.weight, req.activity_level, bmi, req.health_goal, req.allergies)
    return {"success": True, "bmi": bmi}
