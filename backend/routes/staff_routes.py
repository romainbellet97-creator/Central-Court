"""
Routes for staff management and authentication.
GET /api/staff        — list staff for authenticated player
GET /api/staff/{id}   — get one staff member
POST /api/staff/login — staff login (returns auth token)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
from passlib.context import CryptContext

from auth_utils import require_auth

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/api/staff")

db = None


def init_db(database):
    global db
    db = database


def _serialize_staff(s: dict) -> dict:
    return {
        "id": str(s["_id"]),
        "playerId": s.get("playerId", ""),
        "email": s.get("email", ""),
        "firstName": s.get("firstName", ""),
        "lastName": s.get("lastName"),
        "phone": s.get("phone"),
        "role": s.get("role", "other"),
        "roleCustom": s.get("roleCustom"),
        "permissions": s.get("permissions", {}),
        "status": s.get("status", "active"),
        "createdAt": s.get("createdAt", "").isoformat() if isinstance(s.get("createdAt"), datetime) else s.get("createdAt", ""),
        "joinedAt": s.get("joinedAt", "").isoformat() if isinstance(s.get("joinedAt"), datetime) else s.get("joinedAt"),
    }


# ─── GET /api/staff ───────────────────────────────────────────────────────────

@router.get("")
async def list_staff(user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    cursor = db.staff_members.find(
        {"playerId": player_id, "status": {"$ne": "removed"}}
    )
    staff = await cursor.to_list(200)
    return [_serialize_staff(s) for s in staff]


# ─── GET /api/staff/{staff_id} ────────────────────────────────────────────────

@router.get("/{staff_id}")
async def get_staff(staff_id: str, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    try:
        oid = ObjectId(staff_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")
    s = await db.staff_members.find_one(
        {"_id": oid, "playerId": player_id, "status": {"$ne": "removed"}}
    )
    if not s:
        raise HTTPException(status_code=404, detail="Staff introuvable")
    return _serialize_staff(s)


# ─── POST /api/staff/login ────────────────────────────────────────────────────

class StaffLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def staff_login(body: StaffLoginRequest):
    email = body.email.strip().lower()
    s = await db.staff_members.find_one({"email": email, "status": "active"})
    if not s:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    if not _pwd_context.verify(body.password, s.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    # Reuse existing valid token if present
    existing = await db.staff_tokens.find_one({
        "staffId": str(s["_id"]),
        "expiresAt": {"$gt": datetime.now(timezone.utc)},
    })
    if existing:
        token = existing["token"]
    else:
        token = secrets.token_urlsafe(32)
        await db.staff_tokens.insert_one({
            "staffId": str(s["_id"]),
            "token": token,
            "createdAt": datetime.now(timezone.utc),
            "expiresAt": datetime.now(timezone.utc) + timedelta(days=30),
        })

    return {
        "token": token,
        "staff": {
            "id": str(s["_id"]),
            "firstName": s.get("firstName", ""),
            "lastName": s.get("lastName"),
            "email": s.get("email", ""),
            "role": s.get("role", "other"),
            "permissions": s.get("permissions", {}),
            "playerId": s.get("playerId", ""),
        },
    }
