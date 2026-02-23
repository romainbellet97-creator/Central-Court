"""
Routes pour la géolocalisation et le suivi de résidence fiscale.
Gère les présences par jour, les stats par pays et les rapports.
"""
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .auth_helpers import get_current_user_id

router = APIRouter(prefix="/api/residence", tags=["residence"])
db = None

def init_db(database):
    global db
    db = database


# ── Models ──

class DayPresenceCreate(BaseModel):
    date: str  # YYYY-MM-DD
    country: str  # ISO alpha-2
    countryName: str
    status: str = "manual"  # manual, confirmed, inferred
    notes: Optional[str] = None
    userId: str = "default-user"  # DB-2 FIX: Ajout userId pour isolation

class DayPresenceUpdate(BaseModel):
    country: Optional[str] = None
    countryName: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# ── Country mapping ──

COUNTRY_MAP = {
    'FR': 'France', 'MC': 'Monaco', 'CH': 'Suisse', 'ES': 'Espagne',
    'US': 'États-Unis', 'GB': 'Royaume-Uni', 'DE': 'Allemagne', 'IT': 'Italie',
    'AE': 'Émirats arabes unis', 'AU': 'Australie', 'AT': 'Autriche', 'BE': 'Belgique',
    'BR': 'Brésil', 'CA': 'Canada', 'CN': 'Chine', 'HR': 'Croatie',
    'CZ': 'Tchéquie', 'DK': 'Danemark', 'FI': 'Finlande', 'GR': 'Grèce',
    'HU': 'Hongrie', 'IN': 'Inde', 'JP': 'Japon', 'KR': 'Corée du Sud',
    'MX': 'Mexique', 'NL': 'Pays-Bas', 'NO': 'Norvège', 'PL': 'Pologne',
    'PT': 'Portugal', 'QA': 'Qatar', 'RO': 'Roumanie', 'SA': 'Arabie Saoudite',
    'RS': 'Serbie', 'SE': 'Suède', 'TR': 'Turquie', 'AR': 'Argentine',
    'CL': 'Chili', 'CO': 'Colombie', 'MA': 'Maroc', 'TN': 'Tunisie',
}

# Tax thresholds per country
TAX_THRESHOLDS = {
    'FR': 183, 'US': 183, 'GB': 183, 'ES': 183, 'DE': 183,
    'IT': 183, 'CH': 183, 'AE': 183, 'MC': 183, 'AU': 183,
}


@router.get("/countries")
async def get_country_list():
    """Return list of countries for the picker"""
    return [{"code": k, "name": v} for k, v in sorted(COUNTRY_MAP.items(), key=lambda x: x[1])]


# ── Day Presence CRUD ──

@router.post("/days")
async def add_day_presence(data: DayPresenceCreate):
    """Add a day of presence in a country"""
    # DB-2 FIX: Filtrer par userId pour l'isolation utilisateur
    existing = await db.day_presences.find_one(
        {"date": data.date, "userId": data.userId},
        {"_id": 0}
    )
    if existing:
        # Update existing
        await db.day_presences.update_one(
            {"date": data.date, "userId": data.userId},
            {"$set": {
                "country": data.country,
                "countryName": data.countryName,
                "status": data.status,
                "notes": data.notes,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }}
        )
        updated = await db.day_presences.find_one({"date": data.date, "userId": data.userId}, {"_id": 0})
        return updated

    doc = {
        "id": str(uuid.uuid4()),  # DB-13 FIX: UUID complet au lieu de 8 chars
        "userId": data.userId,  # DB-2 FIX: Ajout userId
        "date": data.date,
        "country": data.country,
        "countryName": data.countryName,
        "status": data.status,
        "notes": data.notes,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.day_presences.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/days/{date}")
async def update_day_presence(date: str, data: DayPresenceUpdate):
    """Update a day of presence"""
    existing = await db.day_presences.find_one({"date": date})
    if not existing:
        raise HTTPException(status_code=404, detail="Day not found")
    
    update_fields = {}
    if data.country is not None:
        update_fields["country"] = data.country
    if data.countryName is not None:
        update_fields["countryName"] = data.countryName
    if data.status is not None:
        update_fields["status"] = data.status
    if data.notes is not None:
        update_fields["notes"] = data.notes
    
    update_fields["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.day_presences.update_one(
        {"date": date},
        {"$set": update_fields}
    )
    
    updated = await db.day_presences.find_one({"date": date}, {"_id": 0})
    return updated


@router.delete("/days/{date}")
async def delete_day_presence(date: str):
    """Delete a day of presence"""
    # DB-2 FIX: Filtrer par userId
    userId = "default-user"  # TODO: Get from auth
    result = await db.day_presences.delete_one({"date": date, "userId": userId})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Day not found")
    return {"success": True}


@router.get("/days")
async def get_day_presences(year: int = None, month: Optional[int] = None):
    """Get all day presences for a year (optionally filtered by month)"""
    # DB-12 FIX: Utiliser l'année courante par défaut
    if year is None:
        year = datetime.now().year
    
    # DB-2 FIX: Filtrer par userId
    userId = "default-user"  # TODO: Get from auth
    query = {"date": {"$regex": f"^{year}"}, "userId": userId}
    if month:
        query["date"] = {"$regex": f"^{year}-{month:02d}"}

    days = await db.day_presences.find(query, {"_id": 0}).sort("date", 1).to_list(400)
    return days


# ── Stats ──

@router.get("/stats")
async def get_residence_stats(year: int = None):
    """Calculate country stats for the year"""
    # DB-12 FIX: Utiliser l'année courante par défaut
    if year is None:
        year = datetime.now().year
    
    # DB-2 FIX: Filtrer par userId
    userId = "default-user"  # TODO: Get from auth
    days = await db.day_presences.find(
        {"date": {"$regex": f"^{year}"}, "userId": userId},
        {"_id": 0, "date": 1, "country": 1, "countryName": 1, "status": 1}
    ).to_list(400)

    # Group by country
    country_days: dict = {}
    for d in days:
        cc = d["country"]
        if cc not in country_days:
            country_days[cc] = {
                "country": cc,
                "countryName": d.get("countryName", cc),
                "totalDays": 0,
                "confirmedDays": 0,
                "manualDays": 0,
                "daysByMonth": {},
                "dates": [],
            }
        country_days[cc]["totalDays"] += 1
        if d.get("status") == "manual":
            country_days[cc]["manualDays"] += 1
        else:
            country_days[cc]["confirmedDays"] += 1
        # Month breakdown
        month_key = d["date"][:7]
        country_days[cc]["daysByMonth"][month_key] = country_days[cc]["daysByMonth"].get(month_key, 0) + 1
        country_days[cc]["dates"].append(d["date"])

    # Calculate streaks and periods
    results = []
    for cc, stats in country_days.items():
        dates = sorted(stats["dates"])
        # Longest streak
        longest = 1
        current = 1
        for i in range(1, len(dates)):
            prev = datetime.strptime(dates[i-1], "%Y-%m-%d")
            curr = datetime.strptime(dates[i], "%Y-%m-%d")
            if (curr - prev).days == 1:
                current += 1
                longest = max(longest, current)
            else:
                current = 1

        threshold = TAX_THRESHOLDS.get(cc, 183)
        results.append({
            "country": cc,
            "countryName": stats["countryName"],
            "totalDays": stats["totalDays"],
            "confirmedDays": stats["confirmedDays"],
            "manualDays": stats["manualDays"],
            "daysByMonth": stats["daysByMonth"],
            "firstDay": dates[0] if dates else None,
            "lastDay": dates[-1] if dates else None,
            "longestStreak": longest if dates else 0,
            "threshold": threshold,
            "percentOfThreshold": round((stats["totalDays"] / threshold) * 100, 1) if threshold else 0,
        })

    results.sort(key=lambda x: x["totalDays"], reverse=True)
    total_tracked = sum(r["totalDays"] for r in results)

    # Warnings
    warnings = []
    for r in results:
        pct = r["percentOfThreshold"]
        if pct >= 100:
            warnings.append({
                "type": "threshold_exceeded",
                "country": r["country"],
                "countryName": r["countryName"],
                "message": f"Seuil de {r['threshold']} jours dépassé en {r['countryName']} ({r['totalDays']} jours)",
                "severity": "critical",
            })
        elif pct >= 75:
            warnings.append({
                "type": "approaching_threshold",
                "country": r["country"],
                "countryName": r["countryName"],
                "message": f"Attention : {r['totalDays']}/{r['threshold']} jours en {r['countryName']} ({pct}%)",
                "severity": "warning",
            })

    return {
        "year": year,
        "totalDaysTracked": total_tracked,
        "countries": results,
        "primaryCountry": results[0] if results else None,
        "warnings": warnings,
    }


# ── Bulk add days (range) ──

class BulkDaysCreate(BaseModel):
    startDate: str
    endDate: str
    country: str
    countryName: str
    notes: Optional[str] = None

@router.post("/days/bulk")
async def add_bulk_days(data: BulkDaysCreate):
    """Add multiple days at once (date range)"""
    from datetime import timedelta
    start = datetime.strptime(data.startDate, "%Y-%m-%d")
    end = datetime.strptime(data.endDate, "%Y-%m-%d")
    if end < start:
        raise HTTPException(status_code=400, detail="endDate must be >= startDate")
    if (end - start).days > 90:
        raise HTTPException(status_code=400, detail="Max 90 days per bulk add")

    added = 0
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        existing = await db.day_presences.find_one({"date": date_str})
        if not existing:
            await db.day_presences.insert_one({
                "id": str(uuid.uuid4())[:8],
                "date": date_str,
                "country": data.country,
                "countryName": data.countryName,
                "status": "manual",
                "notes": data.notes,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            })
            added += 1
        current += timedelta(days=1)

    return {"success": True, "added": added, "startDate": data.startDate, "endDate": data.endDate}
