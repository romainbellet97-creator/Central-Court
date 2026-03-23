"""
Routes pour l'onboarding utilisateur et la gestion du profil
"""

import hashlib
import uuid
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Union
from bson import ObjectId

from auth_utils import require_auth

router = APIRouter(prefix="/api/users")

# MongoDB reference
db = None

def init_db(database):
    global db
    db = database


# ============ MODELS ============

class TravelPreferences(BaseModel):
    flightClass: Optional[str] = None  # "economy", "business", "first"
    preferredAirlines: Optional[List[str]] = []
    seatPreference: Optional[str] = None  # "window", "aisle", "middle"
    mealPreference: Optional[str] = None


class HotelPreferences(BaseModel):
    essentialAmenities: Optional[List[str]] = []  # ["wifi", "gym", "pool", etc.]
    roomType: Optional[str] = None
    floorPreference: Optional[str] = None


class FoodPreferences(BaseModel):
    cuisines: Optional[List[str]] = []
    restrictions: Optional[List[str]] = []  # ["vegetarian", "vegan", "gluten-free", etc.]
    allergies: Optional[List[str]] = []


class OnboardingData(BaseModel):
    # Step 1-7: Basic info
    prenom: str
    dateNaissance: Optional[str] = None
    circuits: Optional[List[str]] = []  # ["ATP", "WTA", "ITF"]
    niveaux: Optional[List[str]] = []  # Tournament levels
    classement: Optional[str] = None
    email: str
    residenceFiscale: Optional[str] = None  # Desired tax residence
    
    # Progressive modules
    travelPreferences: Optional[TravelPreferences] = None
    hotelPreferences: Optional[HotelPreferences] = None
    foodPreferences: Optional[FoodPreferences] = None
    
    # Auth
    password: Optional[str] = None  # Hashed server-side before storage

    # Metadata
    onboardingCompleted: bool = False
    onboardingStep: int = 1

    @field_validator('classement', mode='before')
    @classmethod
    def coerce_classement(cls, v):
        if v is None:
            return None
        return str(v)


class OnboardingUpdate(BaseModel):
    prenom: Optional[str] = None
    dateNaissance: Optional[str] = None
    circuits: Optional[List[str]] = None
    niveaux: Optional[List[str]] = None
    classement: Optional[str] = None
    email: Optional[str] = None
    residenceFiscale: Optional[str] = None
    travelPreferences: Optional[TravelPreferences] = None
    hotelPreferences: Optional[HotelPreferences] = None
    foodPreferences: Optional[FoodPreferences] = None
    onboardingCompleted: Optional[bool] = None
    onboardingStep: Optional[int] = None


class UserProfile(BaseModel):
    id: str
    user_id: Optional[str] = None
    prenom: str
    email: str
    dateNaissance: Optional[str] = None
    circuits: Optional[List[str]] = []
    niveaux: Optional[List[str]] = []
    classement: Optional[str] = None
    residenceFiscale: Optional[str] = None
    travelPreferences: Optional[TravelPreferences] = None
    hotelPreferences: Optional[HotelPreferences] = None
    foodPreferences: Optional[FoodPreferences] = None
    onboardingCompleted: bool = False
    onboardingStep: int = 1
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    session_token: Optional[str] = None  # Only returned on registration/login


# ============ HELPER FUNCTIONS ============

def serialize_user(user: dict) -> dict:
    """Convert MongoDB user to API response"""
    return {
        "id": str(user["_id"]),
        "user_id": user.get("user_id"),
        "prenom": user.get("prenom", ""),
        "email": user.get("email", ""),
        "dateNaissance": user.get("dateNaissance"),
        "circuits": user.get("circuits", []),
        "niveaux": user.get("niveaux", []),
        "classement": user.get("classement"),
        "residenceFiscale": user.get("residenceFiscale"),
        "travelPreferences": user.get("travelPreferences"),
        "hotelPreferences": user.get("hotelPreferences"),
        "foodPreferences": user.get("foodPreferences"),
        "onboardingCompleted": user.get("onboardingCompleted", False),
        "onboardingStep": user.get("onboardingStep", 1),
        "createdAt": user.get("createdAt").isoformat() if user.get("createdAt") else None,
        "updatedAt": user.get("updatedAt").isoformat() if user.get("updatedAt") else None,
    }


# ============ ENDPOINTS ============

@router.post("/onboarding", response_model=UserProfile)
async def create_or_update_onboarding(data: OnboardingData):
    """
    Public endpoint: create or update a player account during onboarding.
    No session required — this IS the registration step.
    Returns a session_token on success so the frontend can authenticate immediately.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    now = datetime.now(timezone.utc)

    # Check if player already exists by email
    existing = await db.users.find_one({"email": data.email})

    # Hash password if provided
    password_hash = None
    if data.password:
        password_hash = hashlib.sha256(data.password.encode()).hexdigest()

    user_data = {
        "prenom": data.prenom,
        "email": data.email,
        "dateNaissance": data.dateNaissance,
        "circuits": data.circuits or [],
        "niveaux": data.niveaux or [],
        "classement": data.classement,
        "residenceFiscale": data.residenceFiscale,
        "travelPreferences": data.travelPreferences.dict() if data.travelPreferences else None,
        "hotelPreferences": data.hotelPreferences.dict() if data.hotelPreferences else None,
        "foodPreferences": data.foodPreferences.dict() if data.foodPreferences else None,
        "onboardingCompleted": data.onboardingCompleted,
        "onboardingStep": data.onboardingStep,
        "updatedAt": now,
    }

    if existing:
        player_user_id = existing.get("user_id", str(existing["_id"]))
        update_fields = {**user_data}
        update_fields["user_id"] = player_user_id
        if password_hash:
            update_fields["password_hash"] = password_hash
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields}
        )
        user_data["_id"] = existing["_id"]
        user_data["user_id"] = player_user_id
        user_data["createdAt"] = existing.get("createdAt", now)
    else:
        # New player — generate auth-compatible fields
        player_user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_data["user_id"] = player_user_id
        user_data["name"] = data.prenom        # for /api/auth/me
        user_data["role"] = "player"           # for /api/auth/me
        user_data["created_at"] = now          # for /api/auth/me (server.py User model)
        user_data["createdAt"] = now
        if password_hash:
            user_data["password_hash"] = password_hash
        result = await db.users.insert_one(user_data)
        user_data["_id"] = result.inserted_id

    # Create a session so the frontend is immediately authenticated
    session_token = f"session_{secrets.token_urlsafe(32)}"
    await db.user_sessions.insert_one({
        "user_id": player_user_id,
        "session_token": session_token,
        "expires_at": now + timedelta(days=30),
        "created_at": now,
    })

    serialized = serialize_user(user_data)
    serialized["session_token"] = session_token
    return serialized


@router.put("/onboarding/{user_id}", response_model=UserProfile)
async def update_onboarding(user_id: str, data: OnboardingUpdate, user: dict = Depends(require_auth)):
    """Update specific onboarding fields (must be the authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Build update dict with only non-None values
    update_dict = {}
    for key, value in data.dict().items():
        if value is not None:
            update_dict[key] = value

    update_dict["updatedAt"] = datetime.now(timezone.utc)

    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated = await db.users.find_one({"user_id": user_id})
    return serialize_user(updated)


class ProfileUpdate(BaseModel):
    classement: Optional[str] = None
    email: Optional[str] = None
    residenceFiscale: Optional[str] = None
    prenom: Optional[str] = None


@router.put("/profile/{user_id}", response_model=UserProfile)
async def update_profile(user_id: str, data: ProfileUpdate, user: dict = Depends(require_auth)):
    """Update user profile fields (must be the authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        object_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Build update dict with only non-None values
    update_dict = {}
    for key, value in data.dict().items():
        if value is not None:
            update_dict[key] = value
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_dict["updatedAt"] = datetime.now(timezone.utc)
    
    result = await db.users.update_one(
        {"_id": object_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"_id": object_id})
    return serialize_user(user)


@router.get("/profile/{user_id}", response_model=UserProfile)
async def get_profile(user_id: str, user: dict = Depends(require_auth)):
    """Get user profile by ID (must be the authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        object_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user_doc = await db.users.find_one({"_id": object_id})

    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_user(user_doc)


@router.get("/profile/email/{email}", response_model=UserProfile)
async def get_profile_by_email(email: str, user: dict = Depends(require_auth)):
    """Get user profile by email (must be the authenticated user's own email)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if email != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")

    user_doc = await db.users.find_one({"email": email})

    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_user(user_doc)


@router.post("/onboarding/complete/{user_id}")
async def complete_onboarding(user_id: str, user: dict = Depends(require_auth)):
    """Mark onboarding as completed (must be the authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        object_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    result = await db.users.update_one(
        {"_id": object_id},
        {"$set": {
            "onboardingCompleted": True,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "message": "Onboarding completed"}


@router.post("/onboarding/step/{user_id}")
async def update_onboarding_step(user_id: str, step: int, user: dict = Depends(require_auth)):
    """Update current onboarding step (must be the authenticated user)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        object_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if step < 1 or step > 10:
        raise HTTPException(status_code=400, detail="Step must be between 1 and 10")
    
    result = await db.users.update_one(
        {"_id": object_id},
        {"$set": {
            "onboardingStep": step,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True, "step": step}
