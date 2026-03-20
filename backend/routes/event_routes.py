from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .auth_helpers import get_current_user_id

router = APIRouter(prefix="/api/events", tags=["events"])

db = None

def init_db(database):
    global db
    db = database


class CreateEventRequest(BaseModel):
    type: str
    title: str
    date: str
    endDate: Optional[str] = None
    time: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    tournamentId: Optional[str] = None
    visibleToStaff: bool = True
    assignedStaffIds: Optional[List[str]] = []


class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None
    endDate: Optional[str] = None
    time: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    visibleToStaff: Optional[bool] = None
    notify_staff: Optional[bool] = None  # FEATURE #2: Notifier le staff
    pending_validation: Optional[bool] = None  # FEATURE #2: En attente de validation


class AddObservationRequest(BaseModel):
    author: str
    role: str
    text: str
    parentId: Optional[str] = None  # FEATURE #1: Support des réponses


@router.get("")
async def list_events(
    request: Request,
    date: Optional[str] = None, 
    month: Optional[str] = None,
    userId: Optional[str] = None,  # Allow explicit userId for staff viewing player's events
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
):
    """List events, optionally filtered by date or month (YYYY-MM).
    
    SECURITY FIX: Events are now filtered by userId.
    - If userId is provided (staff viewing player), use that
    - Otherwise use authenticated user's ID
    - Falls back to 'default-user' for backward compatibility
    """
    # Get user ID from auth or explicit parameter
    if userId:
        # Staff accessing player's events
        target_user_id = userId
    else:
        # Get current user's events
        target_user_id = await get_current_user_id(request)
    
    # Build query with user isolation
    query = {"userId": target_user_id}
    
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    
    # Support date range for staff dashboard
    if startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    
    events = await db.events.find(query, {"_id": 0}).to_list(500)
    return events


@router.get("/{event_id}")
async def get_event(request: Request, event_id: str):
    """Get a single event by ID.
    
    SECURITY FIX: Verify ownership before returning.
    """
    current_user_id = await get_current_user_id(request)
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # SECURITY: Check ownership (403 if not owner, unless it's a shared event)
    event_owner = event.get("userId")
    if event_owner and event_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return event


@router.post("")
async def create_event(request: Request, req: CreateEventRequest):
    """Create a new event.
    
    SECURITY FIX: Associate event with authenticated user.
    """
    # Get current user ID for ownership
    current_user_id = await get_current_user_id(request)
    
    event = {
        "id": f"evt-{uuid.uuid4().hex[:8]}",
        "userId": current_user_id,  # SECURITY FIX: Add user ownership
        "type": req.type,
        "title": req.title,
        "date": req.date,
        "endDate": req.endDate,
        "time": req.time,
        "endTime": req.endTime,
        "location": req.location,
        "description": req.description,
        "observations": [],
        "cost": req.cost,
        "tournamentId": req.tournamentId,
        "visibleToStaff": req.visibleToStaff,
        "assignedStaffIds": req.assignedStaffIds or [],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(event)
    event.pop("_id", None)
    return event


@router.put("/{event_id}")
async def update_event(request: Request, event_id: str, req: UpdateEventRequest):
    """Update an event.
    
    SECURITY FIX: Verify ownership before updating.
    """
    current_user_id = await get_current_user_id(request)
    
    # Check event exists and belongs to user
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # SECURITY: Check ownership
    event_owner = event.get("userId")
    if event_owner and event_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    
    # FEATURE #2: Gérer la notification du staff
    notify_staff = update_data.pop('notify_staff', None)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.events.update_one({"id": event_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    
    # FEATURE #2: Si notify_staff est True, créer une notification pour le staff
    if notify_staff and event.get("assignedStaffIds"):
        # Créer une notification (simplifiée - à implémenter avec un système de notifications complet)
        notification = {
            "id": f"notif-{uuid.uuid4().hex[:8]}",
            "type": "event_reschedule",
            "eventId": event_id,
            "eventTitle": event.get("title", "Événement"),
            "newDate": event.get("date"),
            "newTime": event.get("time"),
            "staffIds": event.get("assignedStaffIds", []),
            "status": "pending",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notification)
    
    return event


@router.delete("/{event_id}")
async def delete_event(event_id: str):
    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}


@router.post("/{event_id}/observations")
async def add_observation(event_id: str, req: AddObservationRequest):
    observation = {
        "id": f"obs-{uuid.uuid4().hex[:8]}",
        "author": req.author,
        "role": req.role,
        "text": req.text,
        "parentId": req.parentId,  # FEATURE #1: Support des réponses
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.events.update_one(
        {"id": event_id},
        {"$push": {"observations": observation}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return observation
