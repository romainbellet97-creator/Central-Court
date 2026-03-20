from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import asyncio

from auth_utils import require_auth
from services.email_service import send_email, build_tournament_alert_email

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

db = None

def init_db(database):
    global db
    db = database


class CreateAlertRequest(BaseModel):
    type: str  # flight_missing, hotel_missing, registration_pending, observation_new, slot_suggestion, reminder
    priority: str = "medium"  # high, medium, low
    title: str
    message: str
    tournamentId: Optional[str] = None
    tournamentName: Optional[str] = None
    tournamentCity: Optional[str] = None
    tournamentCountry: Optional[str] = None
    tournamentStartDate: Optional[str] = None
    tournamentEndDate: Optional[str] = None
    eventId: Optional[str] = None
    dueDate: Optional[str] = None
    fromUserName: Optional[str] = None
    fromUserRole: Optional[str] = None
    targetSlot: Optional[dict] = None


@router.get("")
async def list_alerts(unread_only: bool = False, user: dict = Depends(require_auth)):
    """List alerts for the authenticated player"""
    player_id = user["user_id"]
    query = {"player_id": player_id}
    if unread_only:
        query["read"] = False
        query["dismissed"] = False
    alerts = await db.alerts.find(query, {"_id": 0}).sort("createdAt", -1).to_list(100)
    return alerts


@router.post("")
async def create_alert(req: CreateAlertRequest, user: dict = Depends(require_auth)):
    """Create a new alert for the authenticated player"""
    player_id = user["user_id"]
    alert = {
        "id": f"alert-{uuid.uuid4().hex[:8]}",
        "player_id": player_id,
        "type": req.type,
        "priority": req.priority,
        "title": req.title,
        "message": req.message,
        "tournamentId": req.tournamentId,
        "tournamentName": req.tournamentName,
        "tournamentCity": req.tournamentCity,
        "tournamentCountry": req.tournamentCountry,
        "tournamentStartDate": req.tournamentStartDate,
        "tournamentEndDate": req.tournamentEndDate,
        "eventId": req.eventId,
        "dueDate": req.dueDate,
        "fromUserName": req.fromUserName,
        "fromUserRole": req.fromUserRole,
        "targetSlot": req.targetSlot,
        "read": False,
        "dismissed": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.alerts.insert_one(alert)
    alert.pop("_id", None)
    return alert


@router.put("/{alert_id}/read")
async def mark_alert_read(alert_id: str, user: dict = Depends(require_auth)):
    """Mark an alert as read (must belong to the authenticated player)"""
    player_id = user["user_id"]
    result = await db.alerts.update_one(
        {"id": alert_id, "player_id": player_id},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.put("/{alert_id}/dismiss")
async def dismiss_alert(alert_id: str, user: dict = Depends(require_auth)):
    """Dismiss an alert (must belong to the authenticated player)"""
    player_id = user["user_id"]
    result = await db.alerts.update_one(
        {"id": alert_id, "player_id": player_id},
        {"$set": {"dismissed": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.put("/read-all")
async def mark_all_read(user: dict = Depends(require_auth)):
    """Mark all unread alerts as read for the authenticated player"""
    player_id = user["user_id"]
    await db.alerts.update_many(
        {"player_id": player_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"success": True}


@router.post("/generate")
async def generate_alerts(user: dict = Depends(require_auth)):
    """Generate alerts based on the authenticated player's tournament registrations."""
    player_id = user["user_id"]

    registrations = await db.tournament_registrations.find(
        {"player_id": player_id, "status": {"$in": ["participating", "accepted", "pending"]}},
        {"_id": 0, "tournamentId": 1, "status": 1}
    ).limit(100).to_list(100)

    if not registrations:
        return {"generated": 0}

    tournament_ids = [r["tournamentId"] for r in registrations]
    tournaments_list = await db.tournaments.find(
        {"id": {"$in": tournament_ids}},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "country": 1, "startDate": 1, "endDate": 1}
    ).to_list(100)
    tournaments_map = {t["id"]: t for t in tournaments_list}

    # Scope events to this player
    events = await db.events.find(
        {"player_id": player_id},
        {"_id": 0, "id": 1, "title": 1, "date": 1, "time": 1, "type": 1, "tournamentId": 1}
    ).limit(200).to_list(200)

    today = datetime.now(timezone.utc).date()
    new_alerts = []

    for reg in registrations:
        tournament = tournaments_map.get(reg["tournamentId"])
        if not tournament:
            continue

        start_raw = tournament.get("startDate")
        if isinstance(start_raw, datetime):
            start = start_raw.date()
        elif isinstance(start_raw, str):
            start = datetime.strptime(start_raw, "%Y-%m-%d").date()
        else:
            continue
        days_until = (start - today).days
        if days_until <= 0 or days_until > 14:
            continue

        tid = tournament["id"]
        priority = "high" if days_until <= 3 else "medium"
        # Use player-scoped alert ID to avoid cross-player collisions
        alert_prefix = f"alert-{player_id[:8]}"

        # Check flight
        has_flight = any(
            e.get("type") == "travel" and (
                e.get("tournamentId") == tid or
                tournament["city"].lower() in (e.get("title") or "").lower()
            )
            for e in events
        )
        if not has_flight:
            alert_id = f"{alert_prefix}-flight-{tid}"
            existing = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
            if not existing:
                alert = {
                    "id": alert_id,
                    "player_id": player_id,
                    "type": "flight_missing",
                    "priority": priority,
                    "title": "Vol non réservé",
                    "message": f"{tournament['name']} dans {days_until}j",
                    "tournamentId": tid,
                    "tournamentName": tournament["name"],
                    "tournamentCity": tournament["city"],
                    "tournamentCountry": tournament["country"],
                    "tournamentStartDate": tournament["startDate"],
                    "tournamentEndDate": tournament["endDate"],
                    "dueDate": tournament["startDate"],
                    "read": False,
                    "dismissed": False,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                await db.alerts.insert_one(alert)
                new_alerts.append(alert)

        # Check hotel
        has_hotel = any(
            e.get("type") == "hotel" and (
                e.get("tournamentId") == tid or
                tournament["city"].lower() in (e.get("title") or "").lower()
            )
            for e in events
        )
        if not has_hotel:
            alert_id = f"{alert_prefix}-hotel-{tid}"
            existing = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
            if not existing:
                alert = {
                    "id": alert_id,
                    "player_id": player_id,
                    "type": "hotel_missing",
                    "priority": priority,
                    "title": "Hôtel non réservé",
                    "message": f"{tournament['name']} dans {days_until}j",
                    "tournamentId": tid,
                    "tournamentName": tournament["name"],
                    "tournamentCity": tournament["city"],
                    "tournamentCountry": tournament["country"],
                    "tournamentStartDate": tournament["startDate"],
                    "tournamentEndDate": tournament["endDate"],
                    "dueDate": tournament["startDate"],
                    "read": False,
                    "dismissed": False,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                await db.alerts.insert_one(alert)
                new_alerts.append(alert)

        # Check pending registration
        if reg["status"] == "pending":
            alert_id = f"{alert_prefix}-reg-{tid}"
            existing = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
            if not existing:
                alert = {
                    "id": alert_id,
                    "player_id": player_id,
                    "type": "registration_pending",
                    "priority": priority,
                    "title": "Inscription en attente",
                    "message": f"{tournament['name']} dans {days_until}j",
                    "tournamentId": tid,
                    "tournamentName": tournament["name"],
                    "tournamentCity": tournament["city"],
                    "tournamentCountry": tournament["country"],
                    "tournamentStartDate": tournament["startDate"],
                    "tournamentEndDate": tournament["endDate"],
                    "dueDate": tournament["startDate"],
                    "read": False,
                    "dismissed": False,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                }
                await db.alerts.insert_one(alert)
                new_alerts.append(alert)

    # Send email for high priority alerts (fire and forget)
    for alert in new_alerts:
        if alert["priority"] == "high" and alert.get("tournamentName"):
            asyncio.create_task(
                send_email(
                    "romainbasket77@gmail.com",
                    f"🎾 {alert['title']} - {alert['tournamentName']}",
                    build_tournament_alert_email(
                        "Joueur",
                        alert["tournamentName"],
                        alert.get("tournamentCity", ""),
                        alert.get("tournamentCountry", ""),
                        alert.get("tournamentStartDate", ""),
                    )
                )
            )

    return {"generated": len(new_alerts), "alerts": [{"id": a["id"], "type": a["type"]} for a in new_alerts]}
