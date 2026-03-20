"""
Routes pour la gestion des invitations du staff
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import secrets
import string

from auth_utils import require_auth

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
    return {
        "id": str(staff["_id"]),
        "playerId": staff.get("playerId", ""),
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
        },
        'physical_coach': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': False,
            'canManageInvoices': False,
        },
        'physio': {
            'canViewCalendar': True,
            'canEditCalendar': False,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': False,
            'canManageInvoices': False,
        },
        'agent': {
            'canViewCalendar': True,
            'canEditCalendar': True,
            'canViewDocuments': True,
            'canUploadDocuments': True,
            'canViewFinances': True,
            'canManageInvoices': True,
        },
        'family': {
            'canViewCalendar': True,
            'canEditCalendar': False,
            'canViewDocuments': True,
            'canUploadDocuments': False,
            'canViewFinances': False,
            'canManageInvoices': False,
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
async def create_invitation(request: CreateInvitationRequest, user: dict = Depends(require_auth)):
    """Create a new staff invitation (playerId must match authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    # Ensure the caller can only invite for themselves
    if request.playerId != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

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
async def get_player_invitations(player_id: str, user: dict = Depends(require_auth)):
    """Get all invitations sent by a player (must be the authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if player_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

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
async def resend_invitation(invitation_id: str, user: dict = Depends(require_auth)):
    """Resend an invitation (extends expiry) — must belong to the authenticated player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        object_id = ObjectId(invitation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid invitation ID")

    now = datetime.now(timezone.utc)

    result = await db.invitations.update_one(
        {"_id": object_id, "playerId": user["user_id"]},
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
async def cancel_invitation(invitation_id: str, user: dict = Depends(require_auth)):
    """Cancel an invitation — must belong to the authenticated player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        object_id = ObjectId(invitation_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid invitation ID")

    result = await db.invitations.update_one(
        {"_id": object_id, "playerId": user["user_id"], "status": "pending"},
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
    
    # Check if email already registered as staff
    existing_staff = await db.staff_members.find_one({
        "email": invitation["inviteeEmail"],
        "playerId": invitation["playerId"],
        "status": {"$ne": "removed"}
    })
    
    if existing_staff:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    
    # Hash password (basic hash for now - should use bcrypt in production)
    import hashlib
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    # Create staff member
    staff = {
        "playerId": invitation["playerId"],
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
    
    # Generate simple auth token (should use JWT in production)
    auth_token = generate_token(64)
    
    # Store auth token
    await db.staff_tokens.insert_one({
        "staffId": str(staff["_id"]),
        "token": auth_token,
        "createdAt": now,
        "expiresAt": now + timedelta(days=30),
    })
    
    return {
        "success": True,
        "staff": serialize_staff(staff),
        "authToken": auth_token,
    }


@router.get("/staff/player/{player_id}")
async def get_player_staff(player_id: str, user: dict = Depends(require_auth)):
    """Get all active staff members for a player (must be the authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if player_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    cursor = db.staff_members.find({
        "playerId": player_id,
        "status": {"$ne": "removed"}
    }).sort("joinedAt", -1)
    
    staff_list = await cursor.to_list(length=100)
    
    return {"staff": [serialize_staff(s) for s in staff_list]}


@router.delete("/staff/{staff_id}")
async def remove_staff_member(staff_id: str, user: dict = Depends(require_auth)):
    """Remove a staff member (soft delete) — must belong to the authenticated player's team"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        object_id = ObjectId(staff_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid staff ID")

    result = await db.staff_members.update_one(
        {"_id": object_id, "playerId": user["user_id"]},
        {"$set": {"status": "removed"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    return {"success": True, "message": "Membre retiré de l'équipe"}
