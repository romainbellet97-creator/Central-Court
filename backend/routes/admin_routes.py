from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import os
import math

from services.email_service import send_email

router = APIRouter(prefix="/api/admin", tags=["admin"])

db = None
SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "lecourtcentral-admin-secret-2026")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_db(database):
    global db
    db = database


def create_token(data: dict, expires_hours: int = 24):
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_admin(authorization: str = ""):
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    if not token:
        raise HTTPException(status_code=401, detail="Non autorisé")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token invalide")
    admin = await db.admin_users.find_one({"id": payload.get("sub")}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin introuvable")
    return admin


# ── Auth ──

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def admin_login(req: LoginRequest):
    admin = await db.admin_users.find_one({"email": req.email}, {"_id": 0})
    if not admin or not pwd_context.verify(req.password, admin["passwordHash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_token({"sub": admin["id"], "email": admin["email"]})
    return {
        "token": token,
        "user": {"id": admin["id"], "email": admin["email"], "name": admin.get("name", "Admin")}
    }


@router.get("/me")
async def get_me(authorization: str = ""):
    admin = await get_current_admin(authorization)
    return {"id": admin["id"], "email": admin["email"], "name": admin.get("name", "Admin")}


# ── Metrics ──

@router.get("/metrics")
async def get_metrics():
    total_users = await db.app_users.count_documents({"status": {"$ne": "deleted"}})
    active_users = await db.app_users.count_documents({"status": "active"})
    inactive_users = await db.app_users.count_documents({"status": "inactive"})
    suspended_users = await db.app_users.count_documents({"status": "suspended"})

    # Circuit distribution
    pipeline_circuit = [
        {"$match": {"status": {"$ne": "deleted"}}},
        {"$unwind": "$circuits"},
        {"$group": {"_id": "$circuits", "count": {"$sum": 1}}},
    ]
    circuit_data = await db.app_users.aggregate(pipeline_circuit).to_list(10)
    by_circuit = {item["_id"]: item["count"] for item in circuit_data}

    # Activation stats
    onboarding_complete = await db.app_users.count_documents(
        {"activation.hasCompletedOnboarding": True, "status": {"$ne": "deleted"}}
    )
    with_documents = await db.app_users.count_documents(
        {"activation.hasUploadedDocuments": True, "status": {"$ne": "deleted"}}
    )
    with_events = await db.app_users.count_documents(
        {"activation.hasCreatedEvent": True, "status": {"$ne": "deleted"}}
    )
    with_members = await db.app_users.count_documents(
        {"activation.hasInvitedMembers": True, "status": {"$ne": "deleted"}}
    )

    # Staff count
    total_staff = await db.staff_members.count_documents({"status": {"$ne": "removed"}})

    # Avg logins
    pipeline_logins = [
        {"$match": {"status": {"$ne": "deleted"}}},
        {"$group": {"_id": None, "avg": {"$avg": "$activity.loginCount"}}},
    ]
    avg_result = await db.app_users.aggregate(pipeline_logins).to_list(1)
    avg_logins = round(avg_result[0]["avg"], 1) if avg_result else 0

    # Daily logins (last 7 days)
    today = datetime.now(timezone.utc).date()
    daily_logins = []
    all_users = await db.app_users.find({"status": {"$ne": "deleted"}}, {"_id": 0, "activity.loginsByDay": 1}).to_list(500)
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        total = sum(u.get("activity", {}).get("loginsByDay", {}).get(d, 0) for u in all_users)
        daily_logins.append({"date": d, "count": total})

    # Geolocation
    geo_enabled = await db.app_users.count_documents({"geolocation.enabled": True, "status": {"$ne": "deleted"}})

    # Documents
    pipeline_docs = [
        {"$match": {"status": {"$ne": "deleted"}}},
        {"$group": {"_id": None, "totalVault": {"$sum": "$documents.vaultItemsCount"}, "totalInvoices": {"$sum": "$documents.invoicesCount"}, "totalStorage": {"$sum": "$documents.totalStorageUsed"}}},
    ]
    docs_result = await db.app_users.aggregate(pipeline_docs).to_list(1)
    docs_stats = docs_result[0] if docs_result else {"totalVault": 0, "totalInvoices": 0, "totalStorage": 0}

    onboarding_rate = round((onboarding_complete / total_users * 100) if total_users > 0 else 0, 1)

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": inactive_users,
            "suspended": suspended_users,
            "byCircuit": by_circuit,
        },
        "activation": {
            "onboardingCompletionRate": onboarding_rate,
            "usersWithDocuments": with_documents,
            "usersWithEvents": with_events,
            "usersWithMembers": with_members,
        },
        "engagement": {
            "averageLoginsPerUser": avg_logins,
            "dailyLogins": daily_logins,
            "totalStaff": total_staff,
        },
        "geolocation": {
            "enabledUsers": geo_enabled,
            "enabledRate": round((geo_enabled / total_users * 100) if total_users > 0 else 0, 1),
        },
        "documents": {
            "totalUploads": docs_stats.get("totalVault", 0),
            "totalInvoices": docs_stats.get("totalInvoices", 0),
            "totalStorageUsed": round(docs_stats.get("totalStorage", 0) / 1024, 2),
        },
    }


# ── Users ──

@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    circuit: Optional[str] = None,
    status: Optional[str] = None,
    sortBy: str = "createdAt",
    order: str = "desc",
):
    query = {"status": {"$ne": "deleted"}}
    if search:
        query["$or"] = [
            {"prenom": {"$regex": search, "$options": "i"}},
            {"nom": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
        ]
    if circuit:
        query["circuits"] = circuit
    if status:
        query["status"] = status

    sort_dir = -1 if order == "desc" else 1
    sort_field = sortBy if sortBy in ["createdAt", "prenom", "activity.lastLoginAt"] else "createdAt"

    # Get users from both collections (app_users for demo, users for real users)
    total_app = await db.app_users.count_documents(query)
    total_real = await db.users.count_documents({})  # Real users from onboarding
    total = total_app + total_real
    
    total_pages = math.ceil(total / limit) if limit > 0 else 1
    skip = (page - 1) * limit

    # Fetch from app_users (demo)
    app_users_list = await db.app_users.find(query, {"_id": 0}).sort(sort_field, sort_dir).skip(skip).limit(limit).to_list(limit)

    # Also fetch real users from 'users' collection and format them
    real_users_raw = await db.users.find({}, {"_id": 0}).to_list(100)
    real_users_list = []
    for u in real_users_raw:
        real_users_list.append({
            "id": u.get("id", u.get("email", "")),
            "prenom": u.get("firstName", u.get("name", "").split()[0] if u.get("name") else ""),
            "nom": u.get("lastName", u.get("name", "").split()[-1] if u.get("name") and len(u.get("name", "").split()) > 1 else ""),
            "email": u.get("email", ""),
            "telephone": u.get("phone", ""),
            "dateNaissance": u.get("birthDate", ""),
            "circuits": u.get("circuits", []),
            "niveauxTournois": u.get("tournamentLevels", []),
            "classement": u.get("ranking"),
            "status": "active",
            "activation": {
                "hasCompletedOnboarding": u.get("hasCompletedOnboarding", False),
                "onboardingCompletionDate": u.get("createdAt"),
            },
            "createdAt": u.get("createdAt"),
            "updatedAt": u.get("updatedAt"),
        })

    # Combine both lists
    users = app_users_list + real_users_list

    # Attach staff count
    for user in app_users_list:
        staff_count = await db.staff_members.count_documents({"userId": user["id"], "status": {"$ne": "removed"}})
        user["staffCount"] = staff_count

    return {"users": users, "total": total, "page": page, "totalPages": total_pages}


@router.get("/users/{user_id}")
async def get_user_detail(user_id: str):
    user = await db.app_users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    staff = await db.staff_members.find({"userId": user_id, "status": {"$ne": "removed"}}, {"_id": 0}).to_list(50)

    # Build activity chart (last 30 days)
    today = datetime.now(timezone.utc).date()
    activity_chart = []
    logins_by_day = user.get("activity", {}).get("loginsByDay", {})
    for i in range(29, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        activity_chart.append({"date": d, "count": logins_by_day.get(d, 0)})

    return {"user": user, "staff": staff, "activityChart": activity_chart}


class StatusUpdateRequest(BaseModel):
    status: str


@router.put("/users/{user_id}/status")
async def update_user_status(user_id: str, req: StatusUpdateRequest):
    valid = ["active", "inactive", "suspended"]
    if req.status not in valid:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs: {valid}")
    result = await db.app_users.update_one({"id": user_id}, {"$set": {"status": req.status, "updatedAt": datetime.now(timezone.utc).isoformat()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user = await db.app_users.find_one({"id": user_id}, {"_id": 0})
    return {"success": True, "user": user}


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str):
    user = await db.app_users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    # Send reset email
    try:
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2>\U0001f3be Le Court Central</h2>
          <p>Bonjour {user.get('prenom','')},</p>
          <p>Un administrateur a r\u00e9initialis\u00e9 votre mot de passe.</p>
          <p>Votre nouveau mot de passe temporaire : <strong>Tennis2026!</strong></p>
          <p>Veuillez le changer d\u00e8s votre prochaine connexion.</p>
        </div>
        """
        await send_email(user["email"], "\U0001f510 Mot de passe r\u00e9initialis\u00e9 - Le Court Central", html)
    except Exception:
        pass
    # Log activity
    await db.activity_logs.insert_one({
        "type": "password_reset",
        "userId": user_id,
        "userName": f"{user.get('prenom','')} {user.get('nom','')}",
        "description": f"Mot de passe r\u00e9initialis\u00e9 pour {user.get('prenom','')} {user.get('nom','')}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "message": f"Email de r\u00e9initialisation envoy\u00e9 \u00e0 {user['email']}"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    user = await db.app_users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    now = datetime.now(timezone.utc).isoformat()
    await db.app_users.update_one({"id": user_id}, {"$set": {"status": "deleted", "deletedAt": now}})
    deleted_staff = await db.staff_members.update_many({"userId": user_id}, {"$set": {"status": "removed"}})
    await db.activity_logs.insert_one({
        "type": "user_deleted",
        "userId": user_id,
        "userName": f"{user.get('prenom','')} {user.get('nom','')}",
        "description": f"{user.get('prenom','')} {user.get('nom','')} supprim\u00e9(e)",
        "timestamp": now,
    })
    return {"success": True, "message": "Utilisateur supprim\u00e9", "deletedStaffCount": deleted_staff.modified_count}


@router.post("/staff/{staff_id}/reset-password")
async def reset_staff_password(staff_id: str):
    staff = await db.staff_members.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(status_code=404, detail="Staff introuvable")
    try:
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2>\U0001f3be Le Court Central</h2>
          <p>Bonjour {staff.get('prenom','')},</p>
          <p>Votre mot de passe a \u00e9t\u00e9 r\u00e9initialis\u00e9. Nouveau mot de passe : <strong>Tennis2026!</strong></p>
        </div>
        """
        await send_email(staff["email"], "\U0001f510 Mot de passe r\u00e9initialis\u00e9", html)
    except Exception:
        pass
    return {"success": True, "message": f"Email envoy\u00e9 \u00e0 {staff['email']}"}


# ── Activity ──

@router.get("/activity/recent")
async def get_recent_activity(limit: int = 20):
    activities = await db.activity_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"activities": activities}
