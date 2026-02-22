from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

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


@router.get("")
async def list_events(date: Optional[str] = None, month: Optional[str] = None):
    """List events, optionally filtered by date or month (YYYY-MM)"""
    query = {}
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    events = await db.events.find(query, {"_id": 0}).to_list(500)
    return events


@router.get("/{event_id}")
async def get_event(event_id: str):
    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("")
async def create_event(req: CreateEventRequest):
    event = {
        "id": f"evt-{uuid.uuid4().hex[:8]}",
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
async def update_event(event_id: str, req: UpdateEventRequest):
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
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.events.update_one(
        {"id": event_id},
        {"$push": {"observations": observation}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return observation
