"""
DB-4 FIX: Helper d'authentification centralisé pour les routes.
Utilise le système d'auth de server.py (user_id string format).
Supporte les tokens joueurs (user_sessions) ET les tokens staff (staff_members.authToken).
"""
from fastapi import Request, HTTPException
from typing import Optional
from datetime import datetime, timezone

# MongoDB reference (will be initialized by server.py)
db = None

def init_db(database):
    global db
    db = database


def _extract_token(request: Request) -> Optional[str]:
    """Extrait le token depuis cookie ou header Authorization."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token


async def get_current_user_id(request: Request) -> str:
    """
    Récupère le user_id de l'utilisateur authentifié.
    Supporte les joueurs (user_sessions) ET le staff (staff_members.authToken).
    Retourne "default-user" si pas authentifié.
    """
    if db is None:
        return "default-user"

    session_token = _extract_token(request)
    if not session_token:
        return "default-user"

    # 1. Check player sessions first
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0, "user_id": 1, "expires_at": 1}
    )
    if session:
        expires_at = session.get("expires_at")
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                return "default-user"
        return session.get("user_id", "default-user")

    # 2. Check staff token (stored in staff_members.authToken)
    if session_token.startswith("staff_"):
        staff = await db.staff_members.find_one(
            {"authToken": session_token, "status": "active"},
            {"_id": 1}
        )
        if staff:
            return f"staff_{str(staff['_id'])}"

    return "default-user"


async def get_staff_context(request: Request) -> Optional[dict]:
    """
    Si la requête vient d'un membre du staff, retourne ses infos.
    Retourne None si c'est un joueur ou non authentifié.
    Fields: user_id, player_id, name, role, permissions
    """
    if db is None:
        return None

    session_token = _extract_token(request)
    if not session_token or not session_token.startswith("staff_"):
        return None

    staff = await db.staff_members.find_one(
        {"authToken": session_token, "status": "active"},
        {"_id": 1, "playerId": 1, "playerIds": 1, "firstName": 1, "lastName": 1, "role": 1, "permissions": 1}
    )
    if not staff:
        return None

    # Resolve the effective player_id (supports multi-player)
    default_player_id = staff.get("playerId")
    player_ids = staff.get("playerIds") or ([default_player_id] if default_player_id else [])

    # Honour X-Active-Player-Id header if valid
    requested_player = request.headers.get("X-Active-Player-Id")
    if requested_player and requested_player in player_ids:
        effective_player_id = requested_player
    else:
        effective_player_id = default_player_id or (player_ids[0] if player_ids else None)

    return {
        "user_id": f"staff_{str(staff['_id'])}",
        "player_id": effective_player_id,
        "player_ids": player_ids,
        "name": f"{staff.get('firstName', '')} {staff.get('lastName', '')}".strip() or "Staff",
        "role": staff.get("role", "agent"),
        "permissions": staff.get("permissions", {}),
    }


async def require_user_id(request: Request) -> str:
    """
    Version stricte: lève une exception si l'utilisateur n'est pas authentifié.
    """
    user_id = await get_current_user_id(request)
    if user_id == "default-user":
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id
