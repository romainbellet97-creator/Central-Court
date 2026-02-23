"""
DB-4 FIX: Helper d'authentification centralisé pour les routes.
Utilise le système d'auth de server.py (user_id string format).
"""
from fastapi import Request, HTTPException
from typing import Optional
from datetime import datetime, timezone

# MongoDB reference (will be initialized by server.py)
db = None

def init_db(database):
    global db
    db = database


async def get_current_user_id(request: Request) -> str:
    """
    Récupère le user_id de l'utilisateur authentifié.
    Retourne "default-user" si pas authentifié (pour rétrocompatibilité).
    
    DB-4 FIX: Utilise le format string user_id (user_abc123) cohérent avec server.py
    """
    if db is None:
        return "default-user"
    
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return "default-user"
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0, "user_id": 1, "expires_at": 1}
    )
    
    if not session:
        return "default-user"
    
    # Check expiry
    expires_at = session.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return "default-user"
    
    return session.get("user_id", "default-user")


async def require_user_id(request: Request) -> str:
    """
    Version stricte: lève une exception si l'utilisateur n'est pas authentifié.
    """
    user_id = await get_current_user_id(request)
    if user_id == "default-user":
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id
