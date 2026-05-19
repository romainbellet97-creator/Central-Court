from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .auth_helpers import get_current_user_id, get_staff_context

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
    # Staff-side fields (ignored when player creates)
    status: Optional[str] = None
    proposedBy: Optional[str] = None
    proposedByName: Optional[str] = None


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
    notify_staff: Optional[bool] = None
    pending_validation: Optional[bool] = None


class AddObservationRequest(BaseModel):
    author: str
    role: str
    text: str
    parentId: Optional[str] = None


class RespondEventRequest(BaseModel):
    """Player response to a staff-proposed event."""
    action: str  # accept | refuse | reschedule

class CalendarEventItem(BaseModel):
    externalId: str
    title: str
    date: str          # YYYY-MM-DD
    endDate: Optional[str] = None
    time: Optional[str] = None    # HH:MM
    endTime: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    allDay: bool = False
    calendarName: Optional[str] = None

class SyncCalendarRequest(BaseModel):
    events: List[CalendarEventItem]
    note: Optional[str] = None
    alternativeDate: Optional[str] = None
    alternativeTime: Optional[str] = None
    alternativeEndTime: Optional[str] = None


async def _create_alert(user_id: str, alert_type: str, title: str, message: str,
                         event_id: str, from_name: str = None, from_role: str = None,
                         priority: str = "medium"):
    """Helper: insert an alert document into the alerts collection."""
    alert = {
        "id": f"alert-evt-{uuid.uuid4().hex[:8]}",
        "userId": user_id,
        "type": alert_type,
        "priority": priority,
        "title": title,
        "message": message,
        "eventId": event_id,
        "fromUserName": from_name,
        "fromUserRole": from_role,
        "read": False,
        "dismissed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.alerts.insert_one(alert)
    alert.pop("_id", None)
    return alert


@router.get("")
async def list_events(
    request: Request,
    date: Optional[str] = None,
    month: Optional[str] = None,
    userId: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
):
    """List events.

    - Player: own events (all types including personal, full details).
    - Staff: player events via ?userId=, but personal events are masked (no details).
    """
    staff_ctx = await get_staff_context(request)
    is_staff = staff_ctx is not None

    if userId:
        # Resolve MongoDB ObjectId to custom user_id if needed
        try:
            from bson import ObjectId
            player_doc = await db.users.find_one(
                {"_id": ObjectId(userId)}, {"_id": 0, "user_id": 1}
            )
            target_user_id = player_doc["user_id"] if player_doc and player_doc.get("user_id") else userId
        except Exception:
            target_user_id = userId
    else:
        target_user_id = await get_current_user_id(request)

    query = {"userId": target_user_id}

    if date:
        query["date"] = date
    elif month:
        query["date"] = {"$regex": f"^{month}"}

    if startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}

    events = await db.events.find(query, {"_id": 0}).to_list(500)

    # Mask personal event details when staff is fetching
    if is_staff:
        masked = []
        for ev in events:
            if ev.get("type") == "personal" and not ev.get("visibleToStaff", True):
                masked.append({
                    "id": ev["id"],
                    "type": "personal",
                    "title": "Événement personnel",
                    "date": ev["date"],
                    "time": ev.get("time"),
                    "endTime": ev.get("endTime"),
                    "status": ev.get("status"),
                    "_masked": True,
                })
            else:
                masked.append(ev)
        return masked

    return events


@router.get("/{event_id}")
async def get_event(request: Request, event_id: str):
    """Get a single event by ID."""
    current_user_id = await get_current_user_id(request)
    staff_ctx = await get_staff_context(request)

    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event_owner = event.get("userId")

    # Staff can read events they proposed or that belong to their linked player
    if staff_ctx:
        linked_player = staff_ctx.get("player_id")
        if event_owner != linked_player and event.get("proposedBy") != staff_ctx["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        # Mask personal event details for staff
        if event.get("type") == "personal" and not event.get("visibleToStaff", True):
            return {
                "id": event["id"],
                "type": "personal",
                "title": "Événement personnel",
                "date": event["date"],
                "time": event.get("time"),
                "endTime": event.get("endTime"),
                "status": event.get("status"),
                "_masked": True,
            }
        return event

    if event_owner and event_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")

    return event


@router.post("")
async def create_event(request: Request, req: CreateEventRequest):
    """Create a new event.

    - Player creates: stored directly as owner, status=None (no pending).
    - Staff creates: stored under linked player's userId, status=pending_approval,
      proposedBy=staff_id. A notification alert is sent to the player.
    - Staff also see the event as pending on their side.
    """
    current_user_id = await get_current_user_id(request)
    staff_ctx = await get_staff_context(request)

    if staff_ctx and staff_ctx.get("player_id"):
        # Staff proposing a slot to the player
        owner_user_id = staff_ctx["player_id"]
        event_status = "pending_approval"
        proposed_by = staff_ctx["user_id"]
        proposed_by_name = staff_ctx["name"]
        proposed_by_role = staff_ctx.get("role", "")
    else:
        owner_user_id = current_user_id
        event_status = None
        proposed_by = None
        proposed_by_name = None
        proposed_by_role = None

    event_id = f"evt-{uuid.uuid4().hex[:8]}"
    event = {
        "id": event_id,
        "userId": owner_user_id,
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
        "status": event_status,
        "proposedBy": proposed_by,
        "proposedByName": proposed_by_name,
        "proposedByRole": proposed_by_role,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(event)
    event.pop("_id", None)

    # Notify player when staff proposes a slot
    if staff_ctx and staff_ctx.get("player_id"):
        time_str = f" à {req.time}" if req.time else ""
        await _create_alert(
            user_id=owner_user_id,
            alert_type="event_proposal",
            title=f"{proposed_by_name} propose un créneau",
            message=f"{req.title} · {req.date}{time_str}",
            event_id=event_id,
            from_name=proposed_by_name,
            from_role=proposed_by_role,
            priority="medium",
        )

    return event


@router.post("/{event_id}/respond")
async def respond_to_event(request: Request, event_id: str, req: RespondEventRequest):
    """Player responds to a staff-proposed event.

    Actions:
      - accept:     status → confirmed, alert sent to proposing staff
      - refuse:     status → refused, alert sent to proposing staff
      - reschedule: status → rescheduled, alternative date/time stored,
                    alert sent to proposing staff
    """
    current_user_id = await get_current_user_id(request)

    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Only the event owner (player) can respond
    if event.get("userId") != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")

    if event.get("status") not in ("pending_approval", "rescheduled"):
        raise HTTPException(status_code=400, detail="Event is not awaiting a response")

    if req.action == "accept":
        new_status = "confirmed"
        alert_type = "event_accepted"
        alert_title = f"✅ Créneau confirmé"
        alert_msg = f"{event['title']} · {event.get('date')} {event.get('time', '')}".strip()
        if req.note:
            alert_msg += f" — {req.note}"
    elif req.action == "refuse":
        new_status = "refused"
        alert_type = "event_refused"
        alert_title = f"❌ Créneau refusé"
        alert_msg = req.note or f"{event['title']} a été refusé"
    elif req.action == "reschedule":
        new_status = "rescheduled"
        alert_type = "event_rescheduled"
        new_date = req.alternativeDate or event.get("date")
        new_time = req.alternativeTime or ""
        alert_title = f"🔄 Autre horaire proposé"
        alert_msg = f"{event['title']} · {new_date} {new_time}".strip()
        if req.note:
            alert_msg += f" — {req.note}"
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use accept | refuse | reschedule")

    update = {
        "status": new_status,
        "playerNote": req.note,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    if req.action == "reschedule":
        update["alternativeDate"] = req.alternativeDate
        update["alternativeTime"] = req.alternativeTime
        update["alternativeEndTime"] = req.alternativeEndTime

    await db.events.update_one({"id": event_id}, {"$set": update})

    # Notify the staff member who proposed
    proposed_by = event.get("proposedBy")
    if proposed_by:
        await _create_alert(
            user_id=proposed_by,
            alert_type=alert_type,
            title=alert_title,
            message=alert_msg,
            event_id=event_id,
            from_name="Le joueur",
            priority="medium",
        )

    updated = await db.events.find_one({"id": event_id}, {"_id": 0})
    updated.pop("_id", None)
    return updated


@router.put("/{event_id}")
async def update_event(request: Request, event_id: str, req: UpdateEventRequest):
    """Update an event.

    - Player can update own events.
    - Staff can update events they proposed (proposedBy == staff user_id).
    """
    current_user_id = await get_current_user_id(request)
    staff_ctx = await get_staff_context(request)

    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event_owner = event.get("userId")
    proposed_by = event.get("proposedBy")

    # Access check: owner OR the staff who proposed it
    is_owner = event_owner == current_user_id or current_user_id == "default-user"
    is_proposer = staff_ctx and proposed_by == staff_ctx.get("user_id")
    if not is_owner and not is_proposer:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = {k: v for k, v in req.dict().items() if v is not None}
    notify_staff = update_data.pop("notify_staff", None)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await db.events.update_one({"id": event_id}, {"$set": update_data})

    event = await db.events.find_one({"id": event_id}, {"_id": 0})
    event.pop("_id", None)

    # Notify staff if schedule changed
    if notify_staff and event.get("assignedStaffIds"):
        notification = {
            "id": f"notif-{uuid.uuid4().hex[:8]}",
            "type": "event_modified",
            "eventId": event_id,
            "eventTitle": event.get("title", "Événement"),
            "newDate": event.get("date"),
            "newTime": event.get("time"),
            "staffIds": event.get("assignedStaffIds", []),
            "status": "pending",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notification)

        # Also create an alert for each assigned staff
        for staff_id in event.get("assignedStaffIds", []):
            time_str = f" à {event['time']}" if event.get("time") else ""
            await _create_alert(
                user_id=staff_id,
                alert_type="event_modified",
                title="📅 Horaire modifié",
                message=f"{event['title']} · {event.get('date')}{time_str}",
                event_id=event_id,
                from_name="Le joueur",
                priority="medium",
            )

    return event


@router.delete("/calendar-imported")
async def delete_calendar_imported(request: Request, keep_observations: bool = False):
    """Delete events imported from device calendar (source='device_calendar').

    keep_observations=false (default): delete ALL imported calendar events.
    keep_observations=true: only delete imported events that have NO observations.
    """
    user_id = await get_current_user_id(request)
    query: dict = {"userId": user_id, "source": "device_calendar"}
    if keep_observations:
        query["$or"] = [
            {"observations": {"$exists": False}},
            {"observations": {"$size": 0}},
        ]
    result = await db.events.delete_many(query)
    return {"success": True, "deleted": result.deleted_count}


@router.delete("/{event_id}")
async def delete_event(request: Request, event_id: str):
    """Delete an event. Only owner or proposing staff can delete."""
    current_user_id = await get_current_user_id(request)
    staff_ctx = await get_staff_context(request)

    event = await db.events.find_one({"id": event_id}, {"_id": 0, "userId": 1, "proposedBy": 1})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event_owner = event.get("userId")
    proposed_by = event.get("proposedBy")

    is_owner = event_owner == current_user_id or current_user_id == "default-user"
    is_proposer = staff_ctx and proposed_by == staff_ctx.get("user_id")
    if not is_owner and not is_proposer:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.events.delete_one({"id": event_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}


@router.post("/{event_id}/observations")
async def add_observation(request: Request, event_id: str, req: AddObservationRequest):
    """Add observation/comment to an event.

    After adding, generates an event_comment alert for the event owner.
    """
    current_user_id = await get_current_user_id(request)
    staff_ctx = await get_staff_context(request)

    event = await db.events.find_one({"id": event_id}, {"_id": 0, "userId": 1, "title": 1, "proposedBy": 1})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event_owner = event.get("userId")

    # Access check: owner, or staff whose linked player owns the event
    if staff_ctx:
        if event_owner != staff_ctx.get("player_id") and event_owner != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif event_owner and event_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")

    observation = {
        "id": f"obs-{uuid.uuid4().hex[:8]}",
        "author": req.author,
        "role": req.role,
        "text": req.text,
        "parentId": req.parentId,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.events.update_one(
        {"id": event_id},
        {"$push": {"observations": observation}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    # Generate event_comment alert for the event owner
    # (don't alert the author themselves)
    snippet = req.text[:80] + ("..." if len(req.text) > 80 else "")
    if event_owner and event_owner != current_user_id:
        await _create_alert(
            user_id=event_owner,
            alert_type="event_comment",
            title=f"💬 {req.author} a commenté",
            message=f'"{snippet}" — {event.get("title", "")}',
            event_id=event_id,
            from_name=req.author,
            from_role=req.role,
            priority="low",
        )

    # Also notify the staff member who proposed the event, if different
    proposed_by = event.get("proposedBy")
    if proposed_by and proposed_by != current_user_id and proposed_by != event_owner:
        await _create_alert(
            user_id=proposed_by,
            alert_type="event_comment",
            title=f"💬 {req.author} a commenté sur votre proposition",
            message=f'"{snippet}" — {event.get("title", "")}',
            event_id=event_id,
            from_name=req.author,
            from_role=req.role,
            priority="low",
        )

    return observation


# ── External calendar sync ──

@router.post("/sync-external")
async def sync_external_events(req: SyncCalendarRequest, request: Request):
    """Bulk upsert events imported from the device calendar (expo-calendar).

    - Keyed on (userId, externalId) — safe to call repeatedly (idempotent).
    - Only manages events with source='device_calendar'; never touches
      events created manually inside the app.
    - Returns counts of inserted / updated events.
    """
    user_id = await get_current_user_id(request)
    inserted = 0
    updated = 0

    for item in req.events:
        if not item.date:
            continue

        existing = await db.events.find_one(
            {"userId": user_id, "externalId": item.externalId},
            {"_id": 1, "id": 1}
        )

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "userId": user_id,
            "externalId": item.externalId,
            "type": "personal",
            "title": item.title or "(Sans titre)",
            "date": item.date,
            "endDate": item.endDate,
            "time": item.time,
            "endTime": item.endTime,
            "location": item.location or "",
            "description": item.description or "",
            "allDay": item.allDay,
            "calendarName": item.calendarName,
            "visibleToStaff": False,
            "source": "device_calendar",
            "updatedAt": now,
        }

        if existing:
            await db.events.update_one({"_id": existing["_id"]}, {"$set": doc})
            updated += 1
        else:
            doc["id"] = f"cal-{uuid.uuid4().hex[:12]}"
            doc["createdAt"] = now
            doc["observations"] = []
            await db.events.insert_one(doc)
            doc.pop("_id", None)
            inserted += 1

    return {"success": True, "inserted": inserted, "updated": updated}
