from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from .auth_helpers import get_current_user_id

router = APIRouter(prefix="/api/preferences", tags=["preferences"])

db = None

def init_db(database):
    global db
    db = database


class VoyagePreferences(BaseModel):
    travelClass: Optional[str] = None
    airlines: List[str] = []


class HotelPreferences(BaseModel):
    amenities: List[str] = []


class FoodPreferences(BaseModel):
    cuisines: List[str] = []
    restrictions: List[str] = []


class UpdatePreferencesRequest(BaseModel):
    voyage: Optional[VoyagePreferences] = None
    hotel: Optional[HotelPreferences] = None
    food: Optional[FoodPreferences] = None


@router.get("")
async def get_preferences(request: Request):
    """Get user preferences. SECURITY FIX: Use authenticated user."""
    user_id = await get_current_user_id(request)
    prefs = await db.user_preferences.find_one({"userId": user_id}, {"_id": 0})
    if not prefs:
        return {"userId": user_id, "voyage": None, "hotel": None, "food": None}
    return prefs


@router.put("")
async def update_preferences(request: Request, req: UpdatePreferencesRequest):
    """Update user preferences. SECURITY FIX: Use authenticated user."""
    user_id = await get_current_user_id(request)
    update_data = {"userId": user_id, "updatedAt": datetime.now(timezone.utc).isoformat()}
    if req.voyage is not None:
        update_data["voyage"] = req.voyage.dict()
    if req.hotel is not None:
        update_data["hotel"] = req.hotel.dict()
    if req.food is not None:
        update_data["food"] = req.food.dict()

    await db.user_preferences.update_one(
        {"userId": user_id},
        {"$set": update_data},
        upsert=True
    )
    prefs = await db.user_preferences.find_one({"userId": user_id}, {"_id": 0})
    return prefs
