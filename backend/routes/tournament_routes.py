from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])

db = None

def init_db(database):
    global db
    db = database


class RegisterTournamentRequest(BaseModel):
    tournamentId: str
    status: str  # interested, pending, accepted, participating, declined


class HideTournamentRequest(BaseModel):
    tournamentId: str


def serialize_tournament(t: dict) -> dict:
    """Serialize tournament for API response"""
    start_date = t.get("startDate")
    end_date = t.get("endDate")
    
    # Convert to ISO string if needed
    if start_date and hasattr(start_date, 'isoformat'):
        start_date = start_date.isoformat()
    if end_date and hasattr(end_date, 'isoformat'):
        end_date = end_date.isoformat()
    
    return {
        "id": t.get("id"),
        "name": t.get("name"),
        "shortName": t.get("shortName"),
        "circuit": t.get("circuit"),
        "category": t.get("category"),
        "surface": t.get("surface"),
        "startDate": start_date,
        "endDate": end_date,
        "week": t.get("week", 0),
        "city": t.get("city"),
        "country": t.get("country"),
        "countryCode": t.get("countryCode"),
        "venue": t.get("venue"),
        "indoor": t.get("indoor", False),
        "prizeMoney": t.get("prizeMoney", 0),
        "currency": t.get("currency", "USD"),
        "points": t.get("points", 0),
        "drawSingles": t.get("drawSingles", 0),
        "drawDoubles": t.get("drawDoubles", 0),
        "year": t.get("year", 2026),
        "tournamentUrl": t.get("tournamentUrl"),
        "signUpLink": t.get("signUpLink"),
    }


@router.get("/conflicts/{tournament_id}")
async def check_tournament_conflicts(tournament_id: str):
    """Check if a tournament conflicts with calendar events"""
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    t_start = tournament.get("startDate")
    t_end = tournament.get("endDate")
    if not t_start or not t_end:
        return {
            "tournament": {"id": tournament.get("id"), "name": tournament.get("name"), "startDate": None, "endDate": None},
            "calendarEvents": [],
            "conflictingTournaments": [],
            "totalConflicts": 0,
        }
    
    # Add 1 day buffer before and after
    from datetime import timedelta
    if isinstance(t_start, str):
        t_start = datetime.fromisoformat(t_start)
    if isinstance(t_end, str):
        t_end = datetime.fromisoformat(t_end)
    
    buffer_start = t_start - timedelta(days=1)
    buffer_end = t_end + timedelta(days=1)
    
    # Find overlapping events
    events = await db.events.find({
        "$or": [
            {"date": {"$gte": buffer_start.isoformat()[:10], "$lte": buffer_end.isoformat()[:10]}},
        ]
    }, {"_id": 0}).to_list(100)
    
    # Also check string date comparisons (fallback with date range filter)
    if not events:
        all_events = await db.events.find(
            {},
            {"_id": 0, "id": 1, "title": 1, "date": 1, "time": 1, "type": 1, "location": 1}
        ).limit(200).to_list(200)
        events = []
        bs = buffer_start.strftime("%Y-%m-%d")
        be = buffer_end.strftime("%Y-%m-%d")
        for ev in all_events:
            ev_date = ev.get("date", "")
            if isinstance(ev_date, str) and bs <= ev_date[:10] <= be:
                events.append(ev)
    
    # Also check for other tournaments in the same period that are registered
    conflicting_tournaments = []
    regs = await db.tournament_registrations.find(
        {"status": {"$in": ["pending", "participating", "interested"]}},
        {"_id": 0}
    ).to_list(200)
    
    registered_ids = {r["tournamentId"] for r in regs}
    
    if registered_ids:
        other_tournaments = await db.tournaments.find(
            {"id": {"$in": list(registered_ids), "$ne": tournament_id}},
            {"_id": 0}
        ).to_list(200)
        
        for ot in other_tournaments:
            ot_start = ot.get("startDate")
            ot_end = ot.get("endDate")
            if not ot_start or not ot_end:
                continue
            if isinstance(ot_start, str):
                ot_start = datetime.fromisoformat(ot_start)
            if isinstance(ot_end, str):
                ot_end = datetime.fromisoformat(ot_end)
            
            # Check overlap
            if ot_start <= t_end and ot_end >= t_start:
                reg_status = next((r["status"] for r in regs if r["tournamentId"] == ot.get("id")), None)
                conflicting_tournaments.append({
                    "id": ot.get("id"),
                    "name": ot.get("name"),
                    "startDate": ot.get("startDate").isoformat() if hasattr(ot.get("startDate"), 'isoformat') else ot.get("startDate"),
                    "endDate": ot.get("endDate").isoformat() if hasattr(ot.get("endDate"), 'isoformat') else ot.get("endDate"),
                    "status": reg_status,
                    "type": "tournament",
                })
    
    # Format events
    formatted_events = []
    for ev in events:
        formatted_events.append({
            "id": ev.get("id", ""),
            "title": ev.get("title", ""),
            "date": ev.get("date", ""),
            "time": ev.get("time", ""),
            "type": ev.get("type", "other"),
            "location": ev.get("location", ""),
        })
    
    return {
        "tournament": {
            "id": tournament.get("id"),
            "name": tournament.get("name"),
            "startDate": tournament.get("startDate").isoformat() if hasattr(tournament.get("startDate"), 'isoformat') else tournament.get("startDate"),
            "endDate": tournament.get("endDate").isoformat() if hasattr(tournament.get("endDate"), 'isoformat') else tournament.get("endDate"),
        },
        "calendarEvents": formatted_events,
        "conflictingTournaments": conflicting_tournaments,
        "totalConflicts": len(formatted_events) + len(conflicting_tournaments),
    }


@router.get("")
async def list_tournaments(
    circuits: Optional[str] = Query(None, description="Comma-separated circuit filter: ATP,WTA,ITF"),
    category: Optional[str] = None,
    week: Optional[int] = None,
    surface: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0)
):
    """List all tournaments with filters.
    
    Filter by:
    - circuits: Comma-separated list (ATP, WTA, ITF)
    - category: Tournament category (ATP 250, WTA 500, Grand Slam, etc.)
    - week: Week number (1-52)
    - surface: Hard, Clay, Grass, Carpet
    - country: Country name
    """
    query = {}
    
    # Circuit filter
    if circuits:
        circuit_list = [c.strip().upper() for c in circuits.split(",") if c.strip()]
        if circuit_list:
            query["circuit"] = {"$in": circuit_list}
    
    # Category filter
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    # Week filter
    if week:
        query["week"] = week
    
    # Surface filter
    if surface:
        query["surface"] = {"$regex": surface, "$options": "i"}
    
    # Country filter
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    
    cursor = db.tournaments.find(query, {"_id": 0}).sort("startDate", 1).skip(skip).limit(limit)
    tournaments = await cursor.to_list(length=limit)
    
    return [serialize_tournament(t) for t in tournaments]


@router.get("/user/{user_id}")
async def list_user_tournaments(user_id: str, limit: int = Query(default=100, le=500)):
    """Get tournaments based on user's circuit preferences from onboarding"""
    from bson import ObjectId
    
    # Get user's circuit preferences
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_circuits = user.get("circuits", [])
    
    if not user_circuits:
        # Return all tournaments if no preference set
        cursor = db.tournaments.find({}, {"_id": 0}).sort("startDate", 1).limit(limit)
        tournaments = await cursor.to_list(length=limit)
        return [serialize_tournament(t) for t in tournaments]
    
    # Map user circuit choices to database circuit values
    circuit_mapping = {
        "ATP": ["ATP"],
        "WTA": ["WTA"],
        "ITF": ["ITF"],
        "Grand Slam": ["ATP", "WTA"],  # Grand Slams are in both circuits
    }
    
    db_circuits = set()
    for uc in user_circuits:
        mapped = circuit_mapping.get(uc, [uc])
        db_circuits.update(mapped)
    
    query = {"circuit": {"$in": list(db_circuits)}}
    cursor = db.tournaments.find(query, {"_id": 0}).sort("startDate", 1).limit(limit)
    tournaments = await cursor.to_list(length=limit)
    
    return [serialize_tournament(t) for t in tournaments]


@router.get("/weeks")
async def list_tournament_weeks(
    circuits: Optional[str] = Query(None, description="Comma-separated circuit filter: ATP,WTA,ITF,ITF_WHEELCHAIR"),
    categories: Optional[str] = Query(None, description="Comma-separated category filter: Grand Slam,Masters 1000,ATP 500,etc.")
):
    """Get tournaments grouped by week with registrations and hidden status.
    Filter by circuits and categories (comma-separated) to show only relevant tournaments."""
    
    # Mapping of user-facing circuits to database values
    circuit_mapping = {
        'atp': ['atp'],
        'wta': ['wta'],
        'itf': ['itf'],
        'itf_wheelchair': ['itf_wheelchair'],
        # Handle uppercase versions
        'ATP': ['atp'],
        'WTA': ['wta'],
        'ITF': ['itf'],
        'ITF_WHEELCHAIR': ['itf_wheelchair'],
    }
    
    # Parse circuit filter
    db_circuits = []
    if circuits:
        for c in circuits.split(","):
            c = c.strip()
            if c in circuit_mapping:
                db_circuits.extend(circuit_mapping[c])
            else:
                # Direct lowercase match
                db_circuits.append(c.lower())
    
    # Build query
    t_query = {}
    if db_circuits:
        t_query["circuit"] = {"$in": db_circuits}
    
    # Parse category filter
    if categories:
        cat_list = [c.strip() for c in categories.split(",") if c.strip()]
        if cat_list:
            t_query["category"] = {"$in": cat_list}
    
    cursor = db.tournaments.find(t_query, {"_id": 0}).sort("startDate", 1)
    all_tournaments = await cursor.to_list(length=500)

    # Group tournaments by week
    tournaments_by_week = {}
    for t in all_tournaments:
        wn = t.get("week", 0)
        if wn not in tournaments_by_week:
            tournaments_by_week[wn] = []
        tournaments_by_week[wn].append(serialize_tournament(t))

    # Get registrations and hidden for current user (demo: no auth yet)
    registrations = await db.tournament_registrations.find(
        {}, {"_id": 0, "tournamentId": 1, "status": 1, "updatedAt": 1}
    ).limit(500).to_list(500)
    hidden = await db.tournament_hidden.find(
        {}, {"_id": 0, "tournamentId": 1}
    ).limit(500).to_list(500)

    # Build registration map by tournament ID
    reg_by_tournament = {r["tournamentId"]: r for r in registrations}
    hidden_ids = set(h["tournamentId"] for h in hidden)
    
    # Build week data
    weeks = []
    for week_num in sorted(tournaments_by_week.keys()):
        week_tournaments = tournaments_by_week[week_num]
        
        # Get first tournament's date for week label
        first_t = week_tournaments[0] if week_tournaments else None
        
        week_data = {
            "weekNumber": week_num,
            "startDate": first_t.get("startDate") if first_t else None,
            "tournaments": []
        }
        
        for t in week_tournaments:
            t_id = t.get("id")
            t_data = {
                **t,
                "registration": reg_by_tournament.get(t_id),
                "hidden": t_id in hidden_ids,
            }
            week_data["tournaments"].append(t_data)
        
        weeks.append(week_data)
    
    return {"weeks": weeks, "totalTournaments": len(all_tournaments)}


@router.get("/stats")
async def get_tournament_stats():
    """Get statistics about available tournaments"""
    pipeline = [
        {"$group": {
            "_id": "$circuit",
            "count": {"$sum": 1}
        }}
    ]
    
    cursor = db.tournaments.aggregate(pipeline)
    results = await cursor.to_list(length=10)
    
    by_circuit = {r["_id"]: r["count"] for r in results}
    
    return {
        "total": sum(by_circuit.values()),
        "byCircuit": by_circuit
    }


@router.post("/register")
async def register_tournament(req: RegisterTournamentRequest):
    """Register or update registration for a tournament"""
    valid_statuses = ["interested", "pending", "accepted", "participating", "declined"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    # Check tournament exists
    tournament = await db.tournaments.find_one({"id": req.tournamentId}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # Upsert registration
    await db.tournament_registrations.update_one(
        {"tournamentId": req.tournamentId},
        {"$set": {
            "tournamentId": req.tournamentId,
            "status": req.status,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )

    # If participating, hide other tournaments in same week
    if req.status == "participating":
        week_tournaments = await db.tournaments.find(
            {"week": tournament.get("week"), "id": {"$ne": req.tournamentId}},
            {"_id": 0, "id": 1}
        ).to_list(100)
        for t in week_tournaments:
            await db.tournament_hidden.update_one(
                {"tournamentId": t["id"]},
                {"$set": {"tournamentId": t["id"]}},
                upsert=True
            )

    # Remove from hidden if registering
    await db.tournament_hidden.delete_one({"tournamentId": req.tournamentId})

    return {"success": True, "tournamentId": req.tournamentId, "status": req.status}


@router.post("/hide")
async def hide_tournament(req: HideTournamentRequest):
    """Hide a tournament (not interested)"""
    await db.tournament_hidden.update_one(
        {"tournamentId": req.tournamentId},
        {"$set": {"tournamentId": req.tournamentId}},
        upsert=True
    )
    # Remove registration if exists
    await db.tournament_registrations.delete_one({"tournamentId": req.tournamentId})
    return {"success": True}


@router.delete("/hide/{tournament_id}")
async def unhide_tournament(tournament_id: str):
    """Unhide a tournament"""
    await db.tournament_hidden.delete_one({"tournamentId": tournament_id})
    return {"success": True}
