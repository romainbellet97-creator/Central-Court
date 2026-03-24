from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import asyncio

from services.email_service import send_email, build_tournament_alert_email
from .auth_helpers import get_current_user_id

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
async def list_alerts(request: Request, unread_only: bool = False):
    """List alerts for the current user. SECURITY FIX: Filter by userId."""
    current_user_id = await get_current_user_id(request)
    query = {"userId": current_user_id}
    if unread_only:
        query["read"] = False
        query["dismissed"] = False
    alerts = await db.alerts.find(query, {"_id": 0}).sort("createdAt", -1).to_list(100)
    return alerts


@router.post("")
async def create_alert(request: Request, req: CreateAlertRequest):
    """Create a new alert. SECURITY FIX: Associate with authenticated user."""
    current_user_id = await get_current_user_id(request)
    alert = {
        "id": f"alert-{uuid.uuid4().hex[:8]}",
        "userId": current_user_id,
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
async def mark_alert_read(request: Request, alert_id: str):
    """Mark alert as read. SECURITY FIX: Verify ownership."""
    current_user_id = await get_current_user_id(request)
    result = await db.alerts.update_one(
        {"id": alert_id, "userId": current_user_id},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.put("/{alert_id}/dismiss")
async def dismiss_alert(request: Request, alert_id: str):
    """Dismiss alert. SECURITY FIX: Verify ownership."""
    current_user_id = await get_current_user_id(request)
    result = await db.alerts.update_one(
        {"id": alert_id, "userId": current_user_id},
        {"$set": {"dismissed": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"success": True}


@router.put("/read-all")
async def mark_all_read(request: Request):
    """Mark all alerts as read. SECURITY FIX: Only current user's alerts."""
    current_user_id = await get_current_user_id(request)
    await db.alerts.update_many(
        {"read": False, "userId": current_user_id},
        {"$set": {"read": True}}
    )
    return {"success": True}


@router.post("/generate")
async def generate_alerts(request: Request):
    """Generate alerts based on tournament registrations and missing bookings.
    SECURITY FIX: Filter by authenticated user.
    Also sends email notifications for high-priority alerts."""
    current_user_id = await get_current_user_id(request)
    
    # Get active registrations for the current user
    reg_query = {"status": {"$in": ["participating", "accepted", "pending"]}}
    if current_user_id != "default-user":
        reg_query["userId"] = current_user_id
    
    registrations = await db.tournament_registrations.find(
        reg_query,
        {"_id": 0, "tournamentId": 1, "status": 1, "userId": 1}
    ).limit(100).to_list(100)

    if not registrations:
        return {"generated": 0}

    # Batch fetch tournaments (fix N+1 query)
    tournament_ids = [r["tournamentId"] for r in registrations]
    tournaments_list = await db.tournaments.find(
        {"id": {"$in": tournament_ids}},
        {"_id": 0, "id": 1, "name": 1, "city": 1, "country": 1, "startDate": 1, "endDate": 1}
    ).to_list(100)
    tournaments_map = {t["id"]: t for t in tournaments_list}

    # Get events for the current user
    evt_query = {}
    if current_user_id != "default-user":
        evt_query["userId"] = current_user_id
    events = await db.events.find(
        evt_query, {"_id": 0, "id": 1, "title": 1, "date": 1, "time": 1, "type": 1, "tournamentId": 1}
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

        # Check flight
        has_flight = any(
            e.get("type") == "travel" and (
                e.get("tournamentId") == tid or
                tournament["city"].lower() in (e.get("title") or "").lower()
            )
            for e in events
        )
        if not has_flight:
            existing = await db.alerts.find_one({"id": f"alert-flight-{tid}"}, {"_id": 0})
            if not existing:
                alert = {
                    "id": f"alert-flight-{tid}",
                    "userId": current_user_id,
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
            existing = await db.alerts.find_one({"id": f"alert-hotel-{tid}"}, {"_id": 0})
            if not existing:
                alert = {
                    "id": f"alert-hotel-{tid}",
                    "userId": current_user_id,
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
            existing = await db.alerts.find_one({"id": f"alert-reg-{tid}"}, {"_id": 0})
            if not existing:
                alert = {
                    "id": f"alert-reg-{tid}",
                    "userId": current_user_id,
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

    # Check fiscal residence: warn if tournament is outside declared residence country
    year = today.year
    residence_query = {"userId": current_user_id, "date": {"$regex": f"^{year}-"}}
    day_presences = await db.day_presences.find(residence_query, {"_id": 0, "country": 1}).to_list(400)
    if day_presences:
        from collections import Counter
        country_counts = Counter(d["country"] for d in day_presences)
        primary_country = country_counts.most_common(1)[0][0] if country_counts else None

        if primary_country:
            for reg in registrations:
                tournament = tournaments_map.get(reg["tournamentId"])
                if not tournament:
                    continue
                t_country = tournament.get("country", "")
                if t_country and t_country.upper() != primary_country.upper():
                    tid = tournament["id"]
                    existing = await db.alerts.find_one({"id": f"alert-residence-{tid}"}, {"_id": 0})
                    if not existing:
                        alert = {
                            "id": f"alert-residence-{tid}",
                            "userId": current_user_id,
                            "type": "residence_warning",
                            "priority": "medium",
                            "title": "Tournoi hors résidence fiscale",
                            "message": f"{tournament['name']} se déroule en {t_country} (résidence: {primary_country})",
                            "tournamentId": tid,
                            "tournamentName": tournament["name"],
                            "tournamentCity": tournament.get("city", ""),
                            "tournamentCountry": t_country,
                            "tournamentStartDate": tournament.get("startDate"),
                            "tournamentEndDate": tournament.get("endDate"),
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
