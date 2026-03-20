from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from auth_utils import require_auth

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
    date: Optional[str] = None
    endDate: Optional[str] = None
    time: Optional[str] = None
    endTime: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    visibleToStaff: Optional[bool] = None


class AddObservationRequest(BaseModel):
    author: str
    role: str
    text: str


@router.get("")
async def list_events(
    date: Optional[str] = None,
    month: Optional[str] = None,
    user: dict = Depends(require_auth)
):
    """List events for the authenticated user, optionally filtered by date or month (YYYY-MM)"""
    player_id = user["user_id"]
    query = {"player_id": player_id}
    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}
    events = await db.events.find(query, {"_id": 0}).to_list(500)
    return events


@router.get("/{event_id}")
async def get_event(event_id: str, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    event = await db.events.find_one({"id": event_id, "player_id": player_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("")
async def create_event(req: CreateEventRequest, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    event = {
        "id": f"evt-{uuid.uuid4().hex[:8]}",
        "player_id": player_id,
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
async def update_event(event_id: str, req: UpdateEventRequest, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = await db.events.update_one(
        {"id": event_id, "player_id": player_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    event = await db.events.find_one({"id": event_id, "player_id": player_id}, {"_id": 0})
    return event


@router.delete("/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    result = await db.events.delete_one({"id": event_id, "player_id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}


@router.post("/{event_id}/observations")
async def add_observation(event_id: str, req: AddObservationRequest, user: dict = Depends(require_auth)):
    player_id = user["user_id"]
    # Verify ownership before allowing observation
    event = await db.events.find_one({"id": event_id, "player_id": player_id}, {"_id": 0, "id": 1})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    observation = {
        "id": f"obs-{uuid.uuid4().hex[:8]}",
        "author": req.author,
        "role": req.role,
        "text": req.text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.update_one(
        {"id": event_id},
        {"$push": {"observations": observation}}
    )
    return observation
