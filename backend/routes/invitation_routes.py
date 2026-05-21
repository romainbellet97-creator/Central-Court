"""
Routes pour la gestion des invitations du staff
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import string

router = APIRouter(prefix="/api/invitations")

# MongoDB reference
db = None

def init_db(database):
    global db
    db = database


# ============ MODELS ============

class CreateInvitationRequest(BaseModel):
    playerId: str
    inviteeEmail: EmailStr
    inviteeName: Optional[str] = None
    role: str  # 'tennis_coach', 'physical_coach', 'physio', 'agent', 'family', 'other'
    roleCustom: Optional[str] = None


class InvitationResponse(BaseModel):
    id: str
    token: str
    playerId: str
    playerName: str
    inviteeEmail: str
    inviteeName: Optional[str] = None
    role: str
    roleCustom: Optional[str] = None
    status: str  # 'pending', 'accepted', 'expired', 'cancelled'
    createdAt: str
    sentAt: str
    expiresAt: str
    viewedAt: Optional[str] = None
    acceptedAt: Optional[str] = None
    reminderCount: int = 0


class StaffSignupRequest(BaseModel):
    invitationToken: str
    firstName: str
    lastName: Optional[str] = None
    phone: Optional[str] = None
    password: str


class StaffLoginRequest(BaseModel):
    email: str
    password: str


# ============ HELPER FUNCTIONS ============

def generate_token(length: int = 32) -> str:
    """Generate a secure random token"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def make_aware(dt):
    """Ensure datetime is timezone-aware (UTC)"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def serialize_invitation(inv: dict) -> dict:
    """Convert MongoDB invitation to API response"""
    return {
        "id": str(inv["_id"]),
        "token": inv.get("token", ""),
        "playerId": inv.get("playerId", ""),
        "playerName": inv.get("playerName", ""),
        "inviteeEmail": inv.get("inviteeEmail", ""),
        "inviteeName": inv.get("inviteeName"),
        "role": inv.get("role", "other"),
        "roleCustom": inv.get("roleCustom"),
        "status": inv.get("status", "pending"),
        "createdAt": inv.get("createdAt").isoformat() if inv.get("createdAt") else None,
        "sentAt": inv.get("sentAt").isoformat() if inv.get("sentAt") else None,
        "expiresAt": inv.get("expiresAt").isoformat() if inv.get("expiresAt") else None,
        "viewedAt": inv.get("viewedAt").isoformat() if inv.get("viewedAt") else None,
        "acceptedAt": inv.get("acceptedAt").isoformat() if inv.get("acceptedAt") else None,
        "reminderCount": inv.get("reminderCount", 0),
    }


def serialize_staff(staff: dict) -> dict:
    """Convert MongoDB staff member to API response"""
    player_id = staff.get("playerId", "")
    player_ids = staff.get("playerIds") or ([player_id] if player_id else [])
    return {
        "id": str(staff["_id"]),
        "playerId": player_id,
        "playerIds": player_ids,
        "invitationId": staff.get("invitationId"),
        "email": staff.get("email", ""),
        "firstName": staff.get("firstName", ""),
        "lastName": staff.get("lastName"),
        "phone": staff.get("phone"),
        "role": staff.get("role", "other"),
        "roleCustom": staff.get("roleCustom"),
        "permissions": staff.get("permissions", {}),
        "status": staff.get("status", "active"),
        "createdAt": staff.get("createdAt").isoformat() if staff.get("createdAt") else None,
        "invitedAt": staff.get("invitedAt").isoformat() if staff.get("invitedAt") else None,
        "joinedAt": staff.get("joinedAt").isoformat() if staff.get("joinedAt") else None,
    }


def get_default_permissions(role: str) -> dict:
    """Get default permissions based on role"""
    permissions_map = {
        'tennis_coach': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': False,
            'canManageInvoices': False,
            'canCreateBrandActivation': False,
            'proposableTypes': ['tournament', 'training', 'medical', 'media', 'sponsor', 'travel', 'hotel'],
        },
        'physical_coach': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': False,
            'canManageInvoices': False,
            'canCreateBrandActivation': False,
            'proposableTypes': ['physicalPrep', 'travel', 'hotel'],
        },
        'physio': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': False,
            'canManageInvoices': False,
            'canCreateBrandActivation': False,
            'proposableTypes': ['medical'],
        },
        'agent': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': True,
            'canManageInvoices': True,
            'canCreateBrandActivation': True,
            'proposableTypes': None,  # all types
        },
        'family': {
            'canViewCalendar': True,
            'canEditCalendar': False,
            'canViewDocuments': True,
            'canUploadDocuments': False,
            'canViewFinances': False,
            'canManageInvoices': False,
            'canCreateBrandActivation': False,
            'proposableTypes': [],
        },
    }
    return permissions_map.get(role, {
        'canViewCalendar': True,
        'canEditCalendar': False,
        'canViewDocuments': True,
        'canUploadDocuments': False,
        'canViewFinances': False,
        'canManageInvoices': False,
    })


def get_role_label(role: str) -> str:
    """Get French label for role"""
    labels = {
        'tennis_coach': 'Entraîneur Tennis',
        'physical_coach': 'Préparateur Physique',
        'physio': 'Kinésithérapeute',
        'agent': 'Agent',
        'family': 'Famille',
        'other': 'Autre',
    }
    return labels.get(role, 'Membre de l\'équipe')


# ============ ENDPOINTS ============

@router.post("/create", response_model=InvitationResponse)
async def create_invitation(request: CreateInvitationRequest):
    """Create a new staff invitation"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.now(timezone.utc)
    
    # Check if staff member already exists for this player
    existing_staff = await db.staff_members.find_one({
        "playerId": request.playerId,
        "email": request.inviteeEmail,
        "status": {"$ne": "removed"}
    })
    
    if existing_staff:
        raise HTTPException(status_code=400, detail="Cette personne est déjà membre de votre équipe")
    
    # Check for existing pending invitation
    existing_invitation = await db.invitations.find_one({
        "playerId": request.playerId,
        "inviteeEmail": request.inviteeEmail,
        "status": "pending",
        "expiresAt": {"$gt": now}
    })
    
    if existing_invitation:
        # Return existing invitation
        return serialize_invitation(existing_invitation)
    
    # Get player name
    player = await db.users.find_one({"_id": ObjectId(request.playerId)})
    player_name = player.get("prenom", "Un joueur") if player else "Un joueur"
    
    # Generate unique token
    token = generate_token(32)
    
    # Create invitation
    invitation = {
        "token": token,
        "playerId": request.playerId,
        "playerName": player_name,
        "inviteeEmail": request.inviteeEmail,
        "inviteeName": request.inviteeName,
        "role": request.role,
        "roleCustom": request.roleCustom,
        "status": "pending",
        "createdAt": now,
        "sentAt": now,
        "expiresAt": now + timedelta(days=7),
        "reminderCount": 0,
    }
    
    result = await db.invitations.insert_one(invitation)
    invitation["_id"] = result.inserted_id
    
    return serialize_invitation(invitation)


@router.get("/token/{token}")
async def get_invitation_by_token(token: str):
    """Get invitation details by token"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    invitation = await db.invitations.find_one({"token": token})
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    # Check if expired
    now = datetime.now(timezone.utc)
    expires_at = make_aware(invitation.get("expiresAt"))
    if expires_at and expires_at < now:
        if invitation.get("status") == "pending":
            await db.invitations.update_one(
                {"_id": invitation["_id"]},
                {"$set": {"status": "expired"}}
            )
            invitation["status"] = "expired"
    
    return serialize_invitation(invitation)


@router.post("/token/{token}/view")
async def mark_invitation_viewed(token: str):
    """Mark invitation as viewed"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.now(timezone.utc)
    
    result = await db.invitations.update_one(
        {"token": token, "viewedAt": None},
        {"$set": {"viewedAt": now}}
    )
    
    return {"success": True, "updated": result.modified_count > 0}


@router.get("/player/{player_id}")
async def get_player_invitations(player_id: str):
    """Get all invitations sent by a player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Update expired invitations
    now = datetime.now(timezone.utc)
    await db.invitations.update_many(
        {
            "playerId": player_id,
            "status": "pending",
            "expiresAt": {"$lt": now}
        },
        {"$set": {"status": "expired"}}
    )
    
    cursor = db.invitations.find({"playerId": player_id}).sort("createdAt", -1)
    invitations = await cursor.to_list(length=100)
    
    return {"invitations": [serialize_invitation(inv) for inv in invitations]}


@router.post("/{invitation_id}/resend")
async def resend_invitation(invitation_id: str):
    """Resend an invitation (extends expiry)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        object_id = ObjectId(invitation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid invitation ID")
    
    now = datetime.now(timezone.utc)
    
    result = await db.invitations.update_one(
        {"_id": object_id},
        {
            "$set": {
                "status": "pending",
                "sentAt": now,
                "expiresAt": now + timedelta(days=7),
            },
            "$inc": {"reminderCount": 1}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    return {"success": True, "message": "Invitation renvoyée"}


@router.post("/{invitation_id}/cancel")
async def cancel_invitation(invitation_id: str):
    """Cancel an invitation"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        object_id = ObjectId(invitation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid invitation ID")
    
    result = await db.invitations.update_one(
        {"_id": object_id, "status": "pending"},
        {"$set": {"status": "cancelled"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found or already processed")
    
    return {"success": True, "message": "Invitation annulée"}


@router.post("/signup")
async def staff_signup(request: StaffSignupRequest):
    """Sign up as a staff member using invitation token"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    now = datetime.now(timezone.utc)
    
    # Validate invitation token
    invitation = await db.invitations.find_one({
        "token": request.invitationToken,
        "status": "pending"
    })
    
    if not invitation:
        raise HTTPException(status_code=400, detail="Invitation invalide ou déjà utilisée")
    
    # Check expiration
    expires_at = make_aware(invitation.get("expiresAt"))
    if expires_at and expires_at < now:
        raise HTTPException(status_code=400, detail="Invitation expirée")
    
    player_id = invitation["playerId"]

    # Check if a staff member with this email already exists (any player)
    existing_staff = await db.staff_members.find_one({
        "email": invitation["inviteeEmail"],
        "status": {"$ne": "removed"}
    })

    if existing_staff:
        # Check if already linked to THIS player
        existing_player_ids = existing_staff.get("playerIds") or (
            [existing_staff["playerId"]] if existing_staff.get("playerId") else []
        )
        if player_id in existing_player_ids:
            raise HTTPException(status_code=400, detail="Vous êtes déjà membre de l'équipe de ce joueur")

        # Link existing staff account to the new player (multi-player)
        new_player_ids = existing_player_ids + [player_id]
        auth_token = f"staff_{generate_token(48)}"
        await db.staff_members.update_one(
            {"_id": existing_staff["_id"]},
            {"$set": {
                "playerIds": new_player_ids,
                "authToken": auth_token,
                "lastLoginAt": now,
            }}
        )
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "accepted", "acceptedAt": now}}
        )
        existing_staff["playerIds"] = new_player_ids
        existing_staff["authToken"] = auth_token
        return {
            "success": True,
            "staff": serialize_staff(existing_staff),
            "authToken": auth_token,
        }

    # New staff member — hash password with bcrypt
    import bcrypt as _bcrypt
    password_hash = _bcrypt.hashpw(request.password.encode(), _bcrypt.gensalt()).decode()

    # Generate auth token with staff_ prefix (required by auth_helpers.py)
    auth_token = f"staff_{generate_token(48)}"

    # Create staff member
    staff = {
        "playerId": player_id,
        "playerIds": [player_id],
        "invitationId": str(invitation["_id"]),
        "email": invitation["inviteeEmail"],
        "firstName": request.firstName,
        "lastName": request.lastName,
        "phone": request.phone,
        "passwordHash": password_hash,
        "role": invitation["role"],
        "roleCustom": invitation.get("roleCustom"),
        "permissions": get_default_permissions(invitation["role"]),
        "status": "active",
        "authToken": auth_token,
        "createdAt": now,
        "invitedAt": invitation["sentAt"],
        "joinedAt": now,
    }

    result = await db.staff_members.insert_one(staff)
    staff["_id"] = result.inserted_id

    # Update invitation status
    await db.invitations.update_one(
        {"_id": invitation["_id"]},
        {"$set": {"status": "accepted", "acceptedAt": now}}
    )

    return {
        "success": True,
        "staff": serialize_staff(staff),
        "authToken": auth_token,
    }


@router.get("/staff/player/{player_id}")
async def get_player_staff(player_id: str):
    """Get all active staff members for a player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    cursor = db.staff_members.find({
        "playerId": player_id,
        "status": {"$ne": "removed"}
    }).sort("joinedAt", -1)
    
    staff_list = await cursor.to_list(length=100)
    
    return {"staff": [serialize_staff(s) for s in staff_list]}


@router.delete("/staff/{staff_id}")
async def remove_staff_member(staff_id: str):
    """Remove a staff member (soft delete)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    try:
        object_id = ObjectId(staff_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid staff ID")
    
    result = await db.staff_members.update_one(
        {"_id": object_id},
        {"$set": {"status": "removed"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Membre retiré de l'équipe"}


# ============ STAFF LOGIN ============

@router.post("/staff/login")
async def staff_login(req: StaffLoginRequest):
    """Login for existing staff members"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    import bcrypt as _bcrypt
    import hashlib

    # Find staff by email
    staff = await db.staff_members.find_one({
        "email": req.email.lower(),
        "status": "active"
    })

    if not staff:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    stored_hash = staff.get("passwordHash", "")
    password_bytes = req.password.encode()

    # Try bcrypt first (new accounts), then SHA256 (legacy migration)
    try:
        valid = _bcrypt.checkpw(password_bytes, stored_hash.encode())
    except Exception:
        valid = False

    if not valid:
        if hashlib.sha256(password_bytes).hexdigest() != stored_hash:
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        # Re-hash with bcrypt silently
        new_hash = _bcrypt.hashpw(password_bytes, _bcrypt.gensalt()).decode()
        await db.staff_members.update_one({"_id": staff["_id"]}, {"$set": {"passwordHash": new_hash}})
    
    # Generate new auth token
    auth_token = generate_token(64)
    
    # Update staff with new token
    await db.staff_members.update_one(
        {"_id": staff["_id"]},
        {"$set": {
            "authToken": auth_token,
            "lastLoginAt": datetime.now(timezone.utc)
        }}
    )
    
    # Update staff object with new token
    staff["authToken"] = auth_token
    
    return {
        "success": True,
        "staff": serialize_staff(staff),
        "authToken": auth_token,
        "session_token": auth_token,  # For AuthContext compatibility
        "user": {
            "user_id": str(staff["_id"]),
            "email": staff.get("email", ""),
            "name": f"{staff.get('firstName', '')} {staff.get('lastName', '')}".strip(),
            "firstName": staff.get("firstName"),
            "lastName": staff.get("lastName"),
            "role": staff.get("role", "agent"),
            "player_id": staff.get("playerId"),
            "isStaff": True,
        }
    }


@router.get("/staff/me")
async def get_current_staff(authorization: str = None):
    """Get current staff member from auth token"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    from fastapi import Request
    
    # This should be called with the token in header
    # For now, return 401 if no valid way to get token
    raise HTTPException(status_code=401, detail="Not implemented - use /api/auth/staff-login")

