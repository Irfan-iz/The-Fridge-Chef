from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_HOURS

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login", auto_error=False)

def create_access_token(data: dict):
    """Create a JWT token with expiration."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    """Validate JWT token and return the current user. Raises 401 if invalid."""
    if token is None:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in.")
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return {"username": username, "user_id": user_id, "is_admin": payload.get("is_admin", False)}
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid. Please log in again.")

def require_admin(current_user: dict = Depends(get_current_user)):
    """Require admin privileges."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user
