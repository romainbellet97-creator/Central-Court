"""
Shared authentication utilities for route files.
Provides require_auth and require_player FastAPI dependencies.
"""
from fastapi import HTTPException, Request
from typing import Optional
from datetime import datetime, timezone

db = None


def init_db(database):
    global db
    db = database


async def get_current_user(request: Request) -> Optional[dict]:
    """Get current user from session token (cookie or Authorization header)"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        return None

    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session:
        return None

    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None

    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    return user_doc


async def require_auth(request: Request) -> dict:
    """Dependency: require a valid session. Returns the user dict."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_player(request: Request) -> dict:
    """Dependency: require a valid session with player role."""
    user = await require_auth(request)
    if user.get("role") != "player":
        raise HTTPException(status_code=403, detail="Player role required")
    return user
