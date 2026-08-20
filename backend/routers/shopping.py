from fastapi import APIRouter, HTTPException, Depends
from schemas import AddShoppingRequest
import database as db
import dosm_pipeline
from security import get_current_user

router = APIRouter()

@router.get("/api/shopping/{username}")
def get_shopping_list(username: str, current_user: dict = Depends(get_current_user)):
    if username != current_user["username"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Access denied.")
    items = db.get_shopping_list(username)
    
    # Attach DOSM retail reference price to each item (full retail unit price for reference)
    for item in items:
        raw_name  = item["item_name"]
        clean_name = raw_name.split("(")[0].strip()
        price = dosm_pipeline.get_price(clean_name)
        # This is the full retail reference price — label it clearly
        item["dosm_price"] = price if price is not None else None
        item["dosm_price_label"] = "per unit" if price is not None else None
        
    return {"items": items}

@router.post("/api/shopping/add")
def add_shopping(req: AddShoppingRequest, current_user: dict = Depends(get_current_user)):
    if req.username != current_user["username"]:
        raise HTTPException(status_code=403, detail="You can only add to your own shopping list.")
    db.add_shopping_items(req.username, req.recipe_name, req.items)
    return {"success": True}

@router.delete("/api/shopping/delete/{item_id}")
def delete_shopping_item(item_id: int, current_user: dict = Depends(get_current_user)):
    db.delete_shopping_item(item_id)
    return {"success": True}
