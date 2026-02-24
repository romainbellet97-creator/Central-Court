from fastapi import FastAPI, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import uuid
import httpx
import secrets
import base64
import json
import re
import io
import pytesseract
from PIL import Image

load_dotenv()

app = FastAPI(title="Central Court API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
@app.get("/api/landing", response_class=HTMLResponse)
async def root():
    return """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Le Court Central</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#1e3c72 0%,#2a5298 100%);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:28px;padding:40px 28px;max-width:420px;width:100%;text-align:center;color:#1a1a1a;box-shadow:0 24px 80px rgba(0,0,0,0.25)}
.logo{font-size:56px;margin-bottom:12px}
h1{font-size:26px;color:#1e3c72;margin-bottom:6px}
.tagline{color:#888;font-size:14px;margin-bottom:28px}
.steps{text-align:left;margin:0 auto 28px;max-width:320px}
.step{display:flex;align-items:flex-start;gap:12px;margin-bottom:18px}
.step-num{width:28px;height:28px;border-radius:14px;background:#1e3c72;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;margin-top:2px}
.step-content h3{font-size:15px;color:#1a1a1a;margin-bottom:3px}
.step-content p{font-size:13px;color:#888;line-height:1.4}
.stores{display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap}
.store-btn{display:flex;align-items:center;gap:8px;background:#000;color:#fff;padding:10px 18px;border-radius:12px;text-decoration:none;font-size:13px;font-weight:500}
.store-btn svg{width:20px;height:20px;fill:#fff}
.store-btn.android{background:#3DDC84}
.store-btn.android svg{fill:#fff}
.open-btn{display:block;background:#1e3c72;color:#fff;padding:16px;border-radius:14px;text-decoration:none;font-weight:700;font-size:16px;margin:20px auto 0;max-width:320px}
.open-btn:hover{background:#2a5298}
.divider{height:1px;background:#eee;margin:24px 0}
.status{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;color:#2e7d32}
.status-dot{width:8px;height:8px;border-radius:4px;background:#4CAF50}
.note{font-size:11px;color:#bbb;margin-top:16px;line-height:1.4}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🎾</div>
  <h1>Le Court Central</h1>
  <p class="tagline">Tournois, documents & calendrier pour joueurs pro</p>

  <div class="divider"></div>

  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <h3>Installer Expo Go</h3>
        <p>Téléchargez l'app gratuite Expo Go sur votre téléphone</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <h3>Ouvrir l'application</h3>
        <p>Cliquez sur le bouton ci-dessous ou scannez le QR code depuis Expo Go</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <h3>Créer votre profil</h3>
        <p>Choisissez vos circuits (ATP, WTA, ITF) et commencez</p>
      </div>
    </div>
  </div>

  <div class="stores">
    <a class="store-btn" href="https://apps.apple.com/app/expo-go/id982107779" target="_blank">
      <svg viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      App Store
    </a>
    <a class="store-btn android" href="https://play.google.com/store/apps/details?id=host.exp.exponent" target="_blank">
      <svg viewBox="0 0 24 24"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/></svg>
      Play Store
    </a>
  </div>

  <a class="open-btn" href="exp://event-management-9.ngrok.io">
    Ouvrir Le Court Central
  </a>

  <div class="divider"></div>

  <div class="status">
    <div class="status-dot"></div>
    API en ligne — v1.0
  </div>

  <p class="note">
    Version de développement. Pour un accès sans Expo Go,
    sauvegardez le code sur GitHub puis utilisez
    <a href="https://docs.expo.dev/build/introduction/" style="color:#1e3c72" target="_blank">EAS Build</a>
    pour générer l'APK/IPA.
  </p>
</div>
</body>
</html>"""

# MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "central_court")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Register routers
from routes.email_routes import router as email_router
from routes.event_routes import router as event_router, init_db as init_event_db
from routes.tournament_routes import router as tournament_router, init_db as init_tournament_db
from routes.alert_routes import router as alert_router, init_db as init_alert_db
from routes.preference_routes import router as preference_router, init_db as init_preference_db
from routes.admin_routes import router as admin_router, init_db as init_admin_db
from routes.documents import router as documents_router, init_db as init_documents_db
from routes.user_routes import router as user_router, init_db as init_user_db
from routes.invitation_routes import router as invitation_router, init_db as init_invitation_db
from routes.residence_routes import router as residence_router, init_db as init_residence_db
from routes.auth_helpers import init_db as init_auth_helpers_db

# Initialize DB in all routes
init_event_db(db)
init_auth_helpers_db(db)  # DB-4 FIX: Init auth helpers for routes
init_tournament_db(db)
init_alert_db(db)
init_preference_db(db)
init_admin_db(db)
init_documents_db(db)
init_user_db(db)
init_invitation_db(db)
init_residence_db(db)

# DB-9 FIX: Créer TTL index sur les sessions au démarrage
@app.on_event("startup")
async def create_ttl_indexes():
    """Create TTL indexes for automatic session cleanup"""
    try:
        # TTL index sur user_sessions - supprime automatiquement après expires_at
        await db.user_sessions.create_index(
            "expires_at",
            expireAfterSeconds=0,  # Expire exactement à expires_at
            name="session_expiry_ttl"
        )
        print("✅ TTL index created on user_sessions.expires_at")
        
        # TTL index sur invitations - supprime 30 jours après expiration
        await db.staff_invitations.create_index(
            "expiresAt",
            expireAfterSeconds=30 * 24 * 3600,  # 30 jours après expiration
            name="invitation_expiry_ttl"
        )
        print("✅ TTL index created on staff_invitations.expiresAt")
    except Exception as e:
        print(f"⚠️ TTL index creation error (may already exist): {e}")

app.include_router(email_router)
app.include_router(event_router)
app.include_router(tournament_router)
app.include_router(alert_router)
app.include_router(preference_router)
app.include_router(admin_router)
app.include_router(documents_router)
app.include_router(user_router)
app.include_router(invitation_router)
app.include_router(residence_router)

# ============ MODELS ============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "player"  # player, agent, medical, technical, logistics
    player_id: Optional[str] = None  # For staff: which player they belong to
    created_at: datetime

class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str
    player_id: Optional[str] = None

class Invitation(BaseModel):
    invitation_id: str
    code: str
    player_id: str
    player_name: str
    role: str  # agent, medical, technical, logistics
    created_at: datetime
    expires_at: datetime
    used_count: int = 0

class CreateInvitationRequest(BaseModel):
    role: str

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class ExchangeSessionRequest(BaseModel):
    session_id: str

class RegisterWithInvitationRequest(BaseModel):
    session_id: str
    invitation_code: str

# ============ AUTH HELPERS ============

async def get_session_from_emergent(session_id: str) -> Optional[SessionDataResponse]:
    """Exchange session_id for user data from Emergent Auth"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if response.status_code == 200:
                data = response.json()
                return SessionDataResponse(**data)
    except Exception as e:
        print(f"Error exchanging session: {e}")
    return None

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token (cookie or header)"""
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    # Find session
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiry (handle timezone-naive datetimes)
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if user_doc:
        return User(**user_doc)
    return None

async def require_auth(request: Request) -> User:
    """Require authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_player(request: Request) -> User:
    """Require player role"""
    user = await require_auth(request)
    if user.role != "player":
        raise HTTPException(status_code=403, detail="Player role required")
    return user

# ============ AUTH ENDPOINTS ============

@app.post("/api/auth/exchange-session")
async def exchange_session(req: ExchangeSessionRequest, response: Response):
    """Exchange session_id for session_token and create/get user"""
    session_data = await get_session_from_emergent(req.session_id)
    
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": session_data.email},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new player user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": session_data.email,
            "name": session_data.name,
            "picture": session_data.picture,
            "role": "player",
            "player_id": None,
            "created_at": datetime.now(timezone.utc)
        })
    
    # Create session
    session_token = f"session_{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Get user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "session_token": session_token,
        "user": UserResponse(**user)
    }

@app.post("/api/auth/register-with-invitation")
async def register_with_invitation(req: RegisterWithInvitationRequest, response: Response):
    """Register a staff member using an invitation link"""
    # Validate invitation
    invitation = await db.invitations.find_one(
        {"code": req.invitation_code},
        {"_id": 0}
    )
    
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid invitation code")
    
    # Check expiry
    expires_at = invitation["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation expired")
    
    # Exchange session
    session_data = await get_session_from_emergent(req.session_id)
    if not session_data:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if user already exists
    existing_user = await db.users.find_one(
        {"email": session_data.email},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update role if joining a player's team
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "role": invitation["role"],
                "player_id": invitation["player_id"]
            }}
        )
    else:
        # Create new staff user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": session_data.email,
            "name": session_data.name,
            "picture": session_data.picture,
            "role": invitation["role"],
            "player_id": invitation["player_id"],
            "created_at": datetime.now(timezone.utc)
        })
    
    # Increment usage count
    await db.invitations.update_one(
        {"code": req.invitation_code},
        {"$inc": {"used_count": 1}}
    )
    
    # Create session
    session_token = f"session_{secrets.token_urlsafe(32)}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    # Get user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "session_token": session_token,
        "user": UserResponse(**user),
        "player_name": invitation["player_name"]
    }

@app.get("/api/auth/me")
async def get_me(user: User = Depends(require_auth)):
    """Get current user info"""
    return UserResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
        player_id=user.player_id
    )

@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"success": True}

# ============ INVITATION ENDPOINTS ============

@app.post("/api/invitations")
async def create_invitation(req: CreateInvitationRequest, user: User = Depends(require_player)):
    """Create an invitation link for staff members"""
    if req.role not in ["agent", "medical", "technical", "logistics"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    code = secrets.token_urlsafe(16)
    invitation_id = f"inv_{uuid.uuid4().hex[:12]}"
    
    invitation = {
        "invitation_id": invitation_id,
        "code": code,
        "player_id": user.user_id,
        "player_name": user.name,
        "role": req.role,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "used_count": 0
    }
    
    await db.invitations.insert_one(invitation)
    
    return {
        "invitation_id": invitation_id,
        "code": code,
        "role": req.role,
        "expires_at": invitation["expires_at"].isoformat()
    }

@app.get("/api/invitations")
async def get_my_invitations(user: User = Depends(require_player)):
    """Get all invitations created by the player"""
    invitations = await db.invitations.find(
        {"player_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return invitations

@app.delete("/api/invitations/{invitation_id}")
async def delete_invitation(invitation_id: str, user: User = Depends(require_player)):
    """Delete an invitation"""
    result = await db.invitations.delete_one({
        "invitation_id": invitation_id,
        "player_id": user.user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    return {"success": True}

@app.get("/api/invitations/validate/{code}")
async def validate_invitation(code: str):
    """Validate an invitation code (public endpoint)"""
    invitation = await db.invitations.find_one(
        {"code": code},
        {"_id": 0}
    )
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    expires_at = invitation["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation expired")
    
    role_labels = {
        "agent": "Agent",
        "medical": "Staff Médical",
        "technical": "Staff Technique",
        "logistics": "Logistique"
    }
    
    return {
        "valid": True,
        "player_name": invitation["player_name"],
        "role": invitation["role"],
        "role_label": role_labels.get(invitation["role"], invitation["role"])
    }

# ============ TEAM ENDPOINTS ============

@app.get("/api/team")
async def get_my_team(user: User = Depends(require_player)):
    """Get all staff members for the player"""
    team = await db.users.find(
        {"player_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    return [UserResponse(**member) for member in team]

@app.delete("/api/team/{user_id}")
async def remove_team_member(user_id: str, user: User = Depends(require_player)):
    """Remove a team member"""
    result = await db.users.update_one(
        {"user_id": user_id, "player_id": user.user_id},
        {"$set": {"player_id": None, "role": "player"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    return {"success": True}


# ============ STAFF AUTH (proxy to invitation routes) ============

class StaffLoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/staff-login")
async def staff_login(req: StaffLoginRequest):
    """Login for staff members - proxies to invitation routes"""
    import hashlib
    
    # Find staff by email
    staff = await db.staff_members.find_one({
        "email": req.email.lower(),
        "status": "active"
    })
    
    if not staff:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Verify password
    password_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if staff.get("passwordHash") != password_hash:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    # Generate new auth token
    auth_token = f"staff_{uuid.uuid4().hex}"
    
    # Update staff with new token
    await db.staff_members.update_one(
        {"_id": staff["_id"]},
        {"$set": {
            "authToken": auth_token,
            "lastLoginAt": datetime.now(timezone.utc)
        }}
    )
    
    return {
        "success": True,
        "session_token": auth_token,
        "user": {
            "user_id": str(staff["_id"]),
            "email": staff.get("email", ""),
            "name": f"{staff.get('firstName', '')} {staff.get('lastName', '')}".strip(),
            "firstName": staff.get("firstName"),
            "lastName": staff.get("lastName"),
            "role": staff.get("role", "agent"),
            "player_id": staff.get("playerId"),
            "isStaff": True,
        }
    }


# ============ OCR RECEIPT ANALYSIS ============

class OCRResult(BaseModel):
    success: bool
    date: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    confidence: str = "low"
    error: Optional[str] = None
    raw_text: Optional[str] = None

class OCRRequest(BaseModel):
    image_base64: str

def extract_amount_from_text(text: str) -> Optional[float]:
    """Extract the total amount from OCR text using regex patterns"""
    # Common patterns for totals in receipts (French and English)
    amount_patterns = [
        # French patterns
        r'(?:total|montant|solde|net\s*[àa]\s*payer|somme)\s*[:=]?\s*\$?\s*(\d+[\.,]\d{2})',
        r'(?:total|montant)\s*[:=]?\s*(\d+[\.,]\d{2})\s*\$',
        # Currency with $ sign
        r'(\d+[\.,]\d{2})\s*\$',
        r'\$\s*(\d+[\.,]\d{2})',
        # Amount patterns at end of line (common for totals)
        r'(?:total|ttc|tva\s*incluse|net).*?(\d+[\.,]\d{2})',
        # Generic large amounts (likely totals)
        r'(\d{2,}[\.,]\d{2})',
    ]
    
    amounts = []
    for pattern in amount_patterns:
        matches = re.findall(pattern, text.lower(), re.IGNORECASE | re.MULTILINE)
        for match in matches:
            try:
                # Convert comma to dot for float parsing
                amount = float(match.replace(',', '.'))
                if 0.01 <= amount <= 100000:  # Reasonable receipt amount range
                    amounts.append(amount)
            except ValueError:
                continue
    
    # Return the largest amount found (likely the total)
    if amounts:
        return max(amounts)
    return None

def extract_date_from_text(text: str) -> Optional[str]:
    """Extract date from OCR text - DB-6 FIX: Returns ISO 8601 format (YYYY-MM-DD)"""
    # Various date patterns
    date_patterns = [
        # DD/MM/YYYY or DD-MM-YYYY
        r'(\d{1,2})[/\-](\d{1,2})[/\-](20\d{2})',
        # YYYY-MM-DD
        r'(20\d{2})[/\-](\d{1,2})[/\-](\d{1,2})',
        # Month names in French
        r'(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(20\d{2})',
        # Abbreviated months
        r'(\d{1,2})\s+(jan|fev|fév|mar|avr|mai|jun|jui|juil|aou|aoû|sep|oct|nov|dec|déc)\.?\s+(20\d{2})',
    ]
    
    month_map = {
        'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
        'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
        'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
        'jan': '01', 'fev': '02', 'fév': '02', 'mar': '03', 'avr': '04',
        'jun': '06', 'jui': '07', 'juil': '07', 'aou': '08', 'aoû': '08',
        'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12', 'déc': '12'
    }
    
    for pattern in date_patterns:
        match = re.search(pattern, text.lower())
        if match:
            groups = match.groups()
            if len(groups) == 3:
                if groups[0].isdigit() and len(groups[0]) == 4:  # YYYY-MM-DD already
                    year = groups[0]
                    month = groups[1].zfill(2)
                    day = groups[2].zfill(2)
                    return f"{year}-{month}-{day}"  # DB-6 FIX: ISO format
                elif groups[1] in month_map:  # DD Month YYYY
                    day = groups[0].zfill(2)
                    month = month_map[groups[1]]
                    year = groups[2]
                    return f"{year}-{month}-{day}"  # DB-6 FIX: ISO format
                else:  # DD/MM/YYYY
                    day = groups[0].zfill(2)
                    month = groups[1].zfill(2)
                    year = groups[2]
                    if int(month) <= 12:
                        return f"{year}-{month}-{day}"  # DB-6 FIX: ISO format
    
    return None

def extract_merchant_from_text(text: str) -> Optional[str]:
    """Extract merchant name from first lines of OCR text"""
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    # Usually merchant name is in the first few lines
    for line in lines[:5]:
        # Skip lines that are just numbers, dates, or common header text
        if re.match(r'^[\d\s\-/\.]+$', line):
            continue
        if any(skip in line.lower() for skip in ['facture', 'reçu', 'ticket', 'date', 'heure', 'www.', 'http']):
            continue
        if len(line) >= 3 and len(line) <= 50:
            return line.title()
    
    return None

def categorize_receipt(text: str, merchant: Optional[str]) -> str:
    """Categorize the receipt based on text content"""
    text_lower = text.lower()
    merchant_lower = (merchant or '').lower()
    
    # Travel keywords
    travel_keywords = ['avion', 'flight', 'airline', 'train', 'sncf', 'hotel', 'hôtel', 
                      'taxi', 'uber', 'lyft', 'péage', 'carburant', 'essence', 'parking',
                      'aeroport', 'aéroport', 'airport', 'baggage', 'voyage', 'air france',
                      'booking', 'expedia', 'airbnb']
    
    # Medical keywords
    medical_keywords = ['pharmacie', 'pharmacy', 'médecin', 'doctor', 'clinique', 'clinic',
                       'hôpital', 'hospital', 'kiné', 'physio', 'dentiste', 'dentist',
                       'ordonnance', 'prescription', 'laboratoire', 'analyse', 'santé']
    
    # Check for travel
    if any(kw in text_lower or kw in merchant_lower for kw in travel_keywords):
        return 'travel'
    
    # Check for medical
    if any(kw in text_lower or kw in merchant_lower for kw in medical_keywords):
        return 'medical'
    
    # Default to invoices (general expenses)
    return 'invoices'

@app.post("/api/ocr/analyze-receipt", response_model=OCRResult)
async def analyze_receipt(request: OCRRequest):
    """Analyze a receipt image or PDF using Tesseract OCR to extract date, amount, and category"""
    try:
        # Decode base64 data
        try:
            file_data = base64.b64decode(request.image_base64)
        except Exception as e:
            return OCRResult(
                success=False,
                error=f"Failed to decode base64: {str(e)}"
            )
        
        # Check if it's a PDF
        is_pdf = file_data[:4] == b'%PDF'
        
        if is_pdf:
            # Handle PDF - convert first page to image
            try:
                from pdf2image import convert_from_bytes
                pages = convert_from_bytes(file_data, dpi=150, first_page=1, last_page=1)
                if not pages:
                    return OCRResult(
                        success=False,
                        error="Could not convert PDF to image"
                    )
                image = pages[0]
            except Exception as e:
                return OCRResult(
                    success=False,
                    error=f"Failed to process PDF: {str(e)}"
                )
        else:
            # Handle image
            try:
                image = Image.open(io.BytesIO(file_data))
            except Exception as e:
                return OCRResult(
                    success=False,
                    error=f"Failed to open image: {str(e)}"
                )
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Preprocess image for better OCR
        # Resize if too large
        max_size = 2000
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Run Tesseract OCR with French language
        try:
            ocr_text = pytesseract.image_to_string(image, lang='fra+eng')
        except Exception as e:
            # Fallback to English only
            ocr_text = pytesseract.image_to_string(image, lang='eng')
        
        if not ocr_text or len(ocr_text.strip()) < 10:
            return OCRResult(
                success=False,
                error="No text could be extracted from the image",
                raw_text=ocr_text
            )
        
        print(f"OCR Raw Text:\n{ocr_text[:500]}...")  # Log for debugging
        
        # Extract information
        amount = extract_amount_from_text(ocr_text)
        date = extract_date_from_text(ocr_text)
        merchant = extract_merchant_from_text(ocr_text)
        category = categorize_receipt(ocr_text, merchant)
        
        # Calculate confidence based on what was found
        found_count = sum([amount is not None, date is not None, merchant is not None])
        confidence = 'high' if found_count >= 2 else ('medium' if found_count == 1 else 'low')
        
        return OCRResult(
            success=True,
            date=date,
            amount=amount,
            category=category,
            merchant=merchant,
            confidence=confidence,
            raw_text=ocr_text[:500] if ocr_text else None  # Include truncated raw text for debugging
        )
            
    except Exception as e:
        print(f"OCR error: {e}")
        import traceback
        traceback.print_exc()
        return OCRResult(
            success=False,
            error=str(e)
        )

# ============ AI QUICK REPLIES ============

class QuickReplyContext(BaseModel):
    channelType: str
    lastMessages: List[str]
    senderRole: str

class QuickReply(BaseModel):
    id: str
    text: str
    tone: str

@app.post("/api/ai/quick-replies")
async def generate_quick_replies(context: QuickReplyContext):
    """Generate AI-powered quick reply suggestions using OpenAI via Emergent LLM Key"""
    try:
        emergent_key = os.getenv("EMERGENT_LLM_KEY", "")
        
        if not emergent_key:
            # Return fallback replies if no key
            return {"replies": get_fallback_replies(context)}
        
        # Build prompt for OpenAI
        last_msg = context.lastMessages[-1] if context.lastMessages else ""
        
        prompt = f"""Tu es un assistant pour un joueur de tennis professionnel. 
Génère 3 réponses courtes et appropriées pour ce message de son {context.senderRole} ({context.channelType}):

Message reçu: "{last_msg}"

Réponds en français avec 3 suggestions de réponses différentes:
1. Une réponse courte et directe
2. Une réponse amicale et chaleureuse
3. Une réponse professionnelle et formelle

Format de réponse JSON:
[{{"id": "1", "text": "...", "tone": "brief"}}, {{"id": "2", "text": "...", "tone": "friendly"}}, {{"id": "3", "text": "...", "tone": "formal"}}]"""

        # Call OpenAI via Emergent integration
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {emergent_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.7
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # Parse JSON from response
                import json
                try:
                    # Extract JSON array from response
                    start = content.find('[')
                    end = content.rfind(']') + 1
                    if start >= 0 and end > start:
                        replies = json.loads(content[start:end])
                        return {"replies": replies}
                except json.JSONDecodeError:
                    pass
        
        # Fallback if AI fails
        return {"replies": get_fallback_replies(context)}
        
    except Exception as e:
        print(f"AI reply error: {e}")
        return {"replies": get_fallback_replies(context)}

def get_fallback_replies(context: QuickReplyContext) -> List[dict]:
    """Fallback replies when AI is unavailable"""
    last_msg = context.lastMessages[-1].lower() if context.lastMessages else ""
    
    if 'confirmé' in last_msg or 'rdv' in last_msg:
        return [
            {"id": "1", "text": "Parfait, merci !", "tone": "brief"},
            {"id": "2", "text": "Super, j'y serai ! 👍", "tone": "friendly"},
            {"id": "3", "text": "Bien reçu, je confirme ma présence.", "tone": "formal"}
        ]
    
    if '?' in last_msg:
        return [
            {"id": "1", "text": "Je vérifie et te dis.", "tone": "brief"},
            {"id": "2", "text": "Bonne question ! Je regarde ça.", "tone": "friendly"},
            {"id": "3", "text": "Je vous reviens rapidement.", "tone": "formal"}
        ]
    
    return [
        {"id": "1", "text": "Merci !", "tone": "brief"},
        {"id": "2", "text": "Parfait, merci pour l'info ! 😊", "tone": "friendly"},
        {"id": "3", "text": "Bien noté, merci.", "tone": "formal"}
    ]

# ============ HEALTH CHECK ============

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "central-court-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
