from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import database as db
import caching
import dosm_pipeline
from security import require_admin

router = APIRouter()

@router.get("/api/admin/stats")
def admin_stats(current_user: dict = Depends(require_admin)):
    stats = db.get_stats()
    stats["cache_performance"] = caching.global_cache.get_stats()
    return stats

@router.get("/api/cache/stats")
def get_cache_stats():
    return caching.global_cache.get_stats()

@router.post("/api/cache/clear")
def clear_cache(current_user: dict = Depends(require_admin)):
    caching.global_cache.clear()
    return {"success": True, "message": "Real-time cache cleared."}

@router.get("/api/admin/users")
def admin_users(current_user: dict = Depends(require_admin)):
    return {"users": db.get_all_users()}

@router.delete("/api/admin/user/{user_id}")
def delete_user(user_id: int, current_user: dict = Depends(require_admin)):
    # Prevent deleting Admin account
    conn = db.get_connection()
    user = conn.execute("SELECT username FROM Users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    if user and dict(user)["username"] == "Admin":
        raise HTTPException(status_code=403, detail="Cannot delete Admin account.")
    db.delete_user(user_id)
    return {"success": True}

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.post("/api/admin/user/{user_id}/reset-password")
def reset_password(user_id: int, req: ResetPasswordRequest, current_user: dict = Depends(require_admin)):
    db.reset_user_password(user_id, req.new_password)
    return {"success": True}

@router.get("/api/admin/user/{user_id}/history")
def get_user_history(user_id: int, current_user: dict = Depends(require_admin)):
    return {"history": db.get_user_history(user_id)}

@router.get("/api/admin/export/users")
def export_users(current_user: dict = Depends(require_admin)):
    from fastapi.responses import StreamingResponse
    import csv, io
    users = db.get_all_users()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id","username","phone_number","age","gender","height","weight","bmi","health_goal","activity_level","allergies"])
    writer.writeheader()
    writer.writerows(users)
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"})

@router.get("/api/dosm-prices")
def get_dosm_prices():
    # Fetch the live list of all items from the DOSM pipeline
    live_prices = dosm_pipeline.get_all_items()
    return {"prices": live_prices}
