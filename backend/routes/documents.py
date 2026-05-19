"""
Routes pour la gestion des documents (OCR + CRUD + Export PDF)
Collection MongoDB: documents
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import base64
import io

# Import OCR service
from services.ocr_service import analyze_document, analyze_document_with_ai, suggest_category_from_text
from .auth_helpers import get_current_user_id, get_staff_context

router = APIRouter(prefix="/api")

# MongoDB reference (will be set by init_db)
db = None

def init_db(database):
    global db
    db = database


# ============ MODELS ============

class InvoiceLineItem(BaseModel):
    description: str = ""
    quantite: Optional[int] = 1
    prixUnitaire: Optional[float] = None
    montant: Optional[float] = None


class DocumentCreate(BaseModel):
    name: str
    category: str = "other"
    montantTotal: Optional[float] = None
    montantHT: Optional[float] = None
    montantTVA: Optional[float] = None
    currency: str = "EUR"
    numeroFacture: Optional[str] = None
    dateFacture: Optional[str] = None
    fournisseur: Optional[str] = None
    adresse: Optional[str] = None
    lignes: Optional[List[InvoiceLineItem]] = []
    confidence: float = 0.0
    description: Optional[str] = None
    fileType: str = "image"
    fileBase64: Optional[str] = None  # Store original file
    userId: Optional[str] = None


class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    montantTotal: Optional[float] = None
    montantHT: Optional[float] = None
    montantTVA: Optional[float] = None
    dateFacture: Optional[str] = None
    fournisseur: Optional[str] = None
    lignes: Optional[List[InvoiceLineItem]] = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    category: str
    montantTotal: Optional[float] = None
    montantHT: Optional[float] = None
    montantTVA: Optional[float] = None
    currency: str = "EUR"
    numeroFacture: Optional[str] = None
    dateFacture: Optional[str] = None
    fournisseur: Optional[str] = None
    adresse: Optional[str] = None
    lignes: Optional[List[InvoiceLineItem]] = []
    confidence: float = 0.0
    description: Optional[str] = None
    fileType: str = "image"
    hasFile: bool = False
    userId: Optional[str] = None
    playerId: Optional[str] = None       # Set on staff docs: which player can see this
    uploadedByName: Optional[str] = None # Set on staff docs: staff member's name
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class AnalyzeDocumentRequest(BaseModel):
    image_base64: str
    filename: Optional[str] = None


class AnalyzeDocumentResponse(BaseModel):
    success: bool
    amount: Optional[float] = None
    date: Optional[str] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    confidence: Optional[float] = None
    description: Optional[str] = None
    needsReview: Optional[bool] = True
    error: Optional[str] = None


class InvoiceData(BaseModel):
    montantTotal: Optional[float] = None
    montantHT: Optional[float] = None
    montantTVA: Optional[float] = None
    currency: str = "EUR"
    numeroFacture: Optional[str] = None
    dateFacture: Optional[str] = None
    fournisseur: Optional[str] = None
    adresse: Optional[str] = None
    categorie: str = "Autre"
    lignes: Optional[List[InvoiceLineItem]] = []
    confidence: float = 0.0
    needsReview: bool = True
    description: Optional[str] = None
    fileType: Optional[str] = None
    pageCount: Optional[int] = None
    warnings: Optional[List[str]] = None


class InvoiceUploadResponse(BaseModel):
    success: bool
    data: Optional[InvoiceData] = None
    documentId: Optional[str] = None
    error: Optional[str] = None


# ============ HELPER FUNCTIONS ============

def serialize_document(doc: dict) -> dict:
    """Convert MongoDB document to API response format"""
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "category": doc.get("category", "other"),
        "montantTotal": doc.get("montantTotal"),
        "montantHT": doc.get("montantHT"),
        "montantTVA": doc.get("montantTVA"),
        "currency": doc.get("currency", "EUR"),
        "numeroFacture": doc.get("numeroFacture"),
        "dateFacture": doc.get("dateFacture"),
        "fournisseur": doc.get("fournisseur"),
        "adresse": doc.get("adresse"),
        "lignes": doc.get("lignes", []),
        "confidence": doc.get("confidence", 0.0),
        "description": doc.get("description"),
        "fileType": doc.get("fileType", "image"),
        "hasFile": bool(doc.get("fileBase64")),
        "userId": doc.get("userId"),
        "playerId": doc.get("playerId"),
        "uploadedByName": doc.get("uploadedByName"),
        "createdAt": doc["createdAt"].isoformat() if doc.get("createdAt") and hasattr(doc["createdAt"], "isoformat") else (doc.get("createdAt") or None),
        "updatedAt": doc["updatedAt"].isoformat() if doc.get("updatedAt") and hasattr(doc["updatedAt"], "isoformat") else (doc.get("updatedAt") or None),
    }


# ============ CRUD ENDPOINTS ============

@router.post("/documents", response_model=DocumentResponse)
async def create_document(request: Request, doc: DocumentCreate):
    """Create a new document.
    - Player: userId = player, playerId = None
    - Staff: userId = staff's own ID, playerId = linked player's ID (visible to player)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    staff_ctx = await get_staff_context(request)
    now = datetime.now(timezone.utc)

    if staff_ctx:
        owner_user_id = staff_ctx["user_id"]    # staff owns the document
        player_id = staff_ctx["player_id"]      # player can see it
        uploaded_by_name = staff_ctx["name"]
    else:
        owner_user_id = await get_current_user_id(request)
        player_id = None
        uploaded_by_name = None

    document = {
        "name": doc.name,
        "category": doc.category,
        "montantTotal": doc.montantTotal,
        "montantHT": doc.montantHT,
        "montantTVA": doc.montantTVA,
        "currency": doc.currency,
        "numeroFacture": doc.numeroFacture,
        "dateFacture": doc.dateFacture,
        "fournisseur": doc.fournisseur,
        "adresse": doc.adresse,
        "lignes": [l.dict() for l in doc.lignes] if doc.lignes else [],
        "confidence": doc.confidence,
        "description": doc.description,
        "fileType": doc.fileType,
        "fileBase64": doc.fileBase64,
        "userId": owner_user_id,
        "playerId": player_id,
        "uploadedByName": uploaded_by_name,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.documents.insert_one(document)
    document["_id"] = result.inserted_id

    return serialize_document(document)


@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(
    request: Request,
    userId: Optional[str] = None,
    category: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0)
):
    """Get documents.
    - Staff: only their OWN submissions (userId = staff_id).
    - Player: their own docs + staff submissions visible to them (playerId = player_id).
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    staff_ctx = await get_staff_context(request)

    if staff_ctx:
        # Staff sees only documents THEY uploaded
        base_query: dict = {"userId": staff_ctx["user_id"]}
    else:
        current_user_id = await get_current_user_id(request)
        # Player sees their own docs AND staff submissions addressed to them
        base_query = {"$or": [
            {"userId": current_user_id, "playerId": None},
            {"userId": current_user_id, "playerId": {"$exists": False}},
            {"playerId": current_user_id},
        ]}

    # Apply optional filters on top
    extra: dict = {}
    if category:
        extra["category"] = category
    if startDate or endDate:
        date_q: dict = {}
        if startDate:
            date_q["$gte"] = startDate
        if endDate:
            date_q["$lte"] = endDate
        extra["dateFacture"] = date_q

    if extra:
        if "$or" in base_query:
            query = {"$and": [base_query, extra]}
        else:
            query = {**base_query, **extra}
    else:
        query = base_query

    cursor = db.documents.find(query, {"fileBase64": 0}).sort("createdAt", -1).skip(skip).limit(limit)
    documents = await cursor.to_list(length=limit)
    
    return [serialize_document(doc) for doc in documents]


@router.get("/documents/stats")
async def get_documents_stats(
    request: Request,
    userId: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None
):
    """Get documents stats. SECURITY FIX: Filter by auth user."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    if userId:
        try:
            player_doc = await db.users.find_one(
                {"_id": ObjectId(userId)}, {"_id": 0, "user_id": 1}
            )
            target_user_id = player_doc["user_id"] if player_doc and player_doc.get("user_id") else userId
        except Exception:
            target_user_id = userId
    else:
        target_user_id = await get_current_user_id(request)

    query = {"userId": target_user_id}
    if startDate or endDate:
        date_query = {}
        if startDate:
            date_query["$gte"] = startDate
        if endDate:
            date_query["$lte"] = endDate
        if date_query:
            query["dateFacture"] = date_query

    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "total": {"$sum": {"$ifNull": ["$montantTotal", 0]}}
        }}
    ]
    
    cursor = db.documents.aggregate(pipeline)
    results = await cursor.to_list(length=100)
    
    total_count = 0
    total_amount = 0
    by_category = {}
    
    for r in results:
        cat = r["_id"] or "other"
        by_category[cat] = {"count": r["count"], "total": r["total"]}
        total_count += r["count"]
        total_amount += r["total"]
    
    return {
        "totalCount": total_count,
        "totalAmount": total_amount,
        "byCategory": by_category
    }


@router.get("/documents/categories")
async def get_categories():
    """Return available categories"""
    return {
        "categories": [
            {"id": "travel", "label": "Transport", "icon": "airplane"},
            {"id": "accommodation", "label": "Hébergement", "icon": "bed"},
            {"id": "restaurant", "label": "Restauration", "icon": "restaurant"},
            {"id": "medical", "label": "Médical", "icon": "medkit"},
            {"id": "equipment", "label": "Matériel", "icon": "tennisball"},
            {"id": "services", "label": "Services", "icon": "briefcase"},
            {"id": "other", "label": "Autre", "icon": "document"}
        ]
    }


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(request: Request, document_id: str):
    """Get a single document. SECURITY FIX: Verify ownership."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    current_user_id = await get_current_user_id(request)
    
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)}, {"fileBase64": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_owner = doc.get("userId")
    if doc_owner and doc_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    return serialize_document(doc)


@router.get("/documents/{document_id}/file")
async def get_document_file(request: Request, document_id: str):
    """Get document file. SECURITY FIX: Verify ownership."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    current_user_id = await get_current_user_id(request)
    
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)}, {"fileBase64": 1, "fileType": 1, "name": 1, "userId": 1})
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_owner = doc.get("userId")
    if doc_owner and doc_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not doc.get("fileBase64"):
        raise HTTPException(status_code=404, detail="No file attached to this document")
    
    file_bytes = base64.b64decode(doc["fileBase64"])
    file_type = doc.get("fileType", "image")
    
    if file_type == "pdf":
        media_type = "application/pdf"
    else:
        media_type = "image/png"
    
    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.get("name", "document")}"'}
    )


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(request: Request, document_id: str, update: DocumentUpdate):
    """Update a document. SECURITY FIX: Verify ownership."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    current_user_id = await get_current_user_id(request)
    
    try:
        object_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    
    # Check ownership
    doc = await db.documents.find_one({"_id": object_id}, {"userId": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_owner = doc.get("userId")
    if doc_owner and doc_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = {k: v for k, v in update.dict().items() if v is not None}
    
    if update_dict.get("lignes"):
        update_dict["lignes"] = [l.dict() if hasattr(l, 'dict') else l for l in update_dict["lignes"]]
    
    update_dict["updatedAt"] = datetime.now(timezone.utc)
    
    result = await db.documents.update_one(
        {"_id": object_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = await db.documents.find_one({"_id": object_id}, {"fileBase64": 0})
    return serialize_document(doc)


@router.delete("/documents/{document_id}")
async def delete_document(request: Request, document_id: str):
    """Delete a document. SECURITY FIX: Verify ownership."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    current_user_id = await get_current_user_id(request)
    
    try:
        object_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")
    
    # Check ownership
    doc = await db.documents.find_one({"_id": object_id}, {"userId": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc_owner = doc.get("userId")
    if doc_owner and doc_owner != current_user_id and current_user_id != "default-user":
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.documents.delete_one({"_id": object_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True, "message": "Document deleted"}


# ============ STAFF MULTIPART UPLOAD ============

@router.post("/documents/upload")
async def upload_document_multipart(
    request: Request,
    file: UploadFile = File(...),
):
    """Multipart upload with OCR. Works for both players and staff.
    Staff: document owned by staff (userId=staff_id), visible to linked player (playerId=player_id).
    Player: document owned by player, no playerId."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    staff_ctx = await get_staff_context(request)
    if staff_ctx:
        owner_user_id = staff_ctx["user_id"]   # staff owns the document
        player_id = staff_ctx["player_id"]     # player can see it
        uploaded_by_name = staff_ctx["name"]
    else:
        owner_user_id = await get_current_user_id(request)
        player_id = None
        uploaded_by_name = None

    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    content_type = file.content_type or ''
    filename = file.filename or 'document'
    file_extension = filename.lower().split('.')[-1] if '.' in filename else ''

    if content_type not in allowed_types:
        ext_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'pdf': 'application/pdf'}
        content_type = ext_map.get(file_extension, content_type)

    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Type non supporté: {content_type}")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 20 MB)")

    # Run OCR — use data even on partial success (OCR may fail but still return category/date)
    try:
        ocr_result = await analyze_document(file_bytes, filename, content_type)
        invoice_data = ocr_result.get("data") or {}
    except Exception:
        invoice_data = {}

    file_type = "pdf" if content_type == "application/pdf" else "image"
    file_base64 = base64.b64encode(file_bytes).decode("utf-8")
    now = datetime.now(timezone.utc)

    # Normalize category
    raw_cat = invoice_data.get("categorie", "other") or "other"
    CAT_MAP = {
        "Transport": "travel", "Hébergement": "accommodation", "Restauration": "restaurant",
        "Médical": "medical", "Matériel": "equipment", "Équipement": "equipment",
        "Services": "services", "Autre": "other",
    }
    category = CAT_MAP.get(raw_cat, raw_cat)

    # Normalize date to YYYY-MM-DD (OCR may return DD/MM/YYYY)
    raw_date = invoice_data.get("dateFacture")
    if raw_date and "/" in str(raw_date):
        try:
            parts = raw_date.split("/")
            if len(parts) == 3 and len(parts[2]) == 4:
                raw_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        except Exception:
            pass

    document = {
        "name": filename,
        "category": category,
        "montantTotal": invoice_data.get("montantTotal"),
        "montantHT": invoice_data.get("montantHT"),
        "montantTVA": invoice_data.get("montantTVA"),
        "currency": invoice_data.get("currency", "EUR"),
        "numeroFacture": invoice_data.get("numeroFacture"),
        "dateFacture": raw_date,
        "fournisseur": invoice_data.get("fournisseur"),
        "adresse": invoice_data.get("adresse"),
        "lignes": invoice_data.get("lignes", []),
        "confidence": invoice_data.get("confidence", 0.0),
        "description": invoice_data.get("description"),
        "fileType": file_type,
        "fileBase64": file_base64,
        "userId": owner_user_id,
        "playerId": player_id,
        "uploadedByName": uploaded_by_name,
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.documents.insert_one(document)
    document["_id"] = result.inserted_id
    return serialize_document(document)


# ============ OCR ENDPOINTS ============

@router.post("/documents/analyze", response_model=AnalyzeDocumentResponse)
async def analyze_document_endpoint(request: AnalyzeDocumentRequest):
    """Analyze an image document with OCR (legacy endpoint)"""
    try:
        result = await analyze_document_with_ai(request.image_base64)
        
        if result['success']:
            data = result['data']
            return AnalyzeDocumentResponse(
                success=True,
                amount=data.get('amount'),
                date=data.get('date'),
                category=data.get('category', 'other'),
                merchant=data.get('merchant'),
                confidence=data.get('confidence'),
                description=data.get('description'),
                needsReview=data.get('needsReview', True)
            )
        else:
            category = 'other'
            if request.filename:
                category = suggest_category_from_text(request.filename)
            
            return AnalyzeDocumentResponse(
                success=False,
                category=category,
                error=result.get('error', 'Unknown error')
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoices/upload", response_model=InvoiceUploadResponse)
async def upload_invoice(file: UploadFile = File(...)):
    """Upload and analyze an invoice (image or PDF)"""
    try:
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
        content_type = file.content_type or ''
        filename = file.filename or 'document'
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        if content_type not in allowed_types:
            ext_to_type = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'pdf': 'application/pdf'}
            content_type = ext_to_type.get(file_extension, content_type)
        
        if content_type not in allowed_types:
            return InvoiceUploadResponse(success=False, error=f"Type non supporté: {content_type}")
        
        file_bytes = await file.read()
        
        if len(file_bytes) == 0:
            return InvoiceUploadResponse(success=False, error="Fichier vide")
        
        if len(file_bytes) > 20 * 1024 * 1024:
            return InvoiceUploadResponse(success=False, error="Fichier trop volumineux (max 20MB)")
        
        file_type = 'pdf' if content_type == 'application/pdf' or file_extension == 'pdf' else 'image'
        result = await analyze_document(file_bytes, filename, file_type)
        
        if result.get('success'):
            data = result.get('data', {})
            
            lignes = []
            for ligne in data.get('lignes', []):
                if isinstance(ligne, dict):
                    lignes.append(InvoiceLineItem(**ligne))
            
            invoice_data = InvoiceData(
                montantTotal=data.get('montantTotal'),
                montantHT=data.get('montantHT'),
                montantTVA=data.get('montantTVA'),
                currency=data.get('currency', 'EUR'),
                numeroFacture=data.get('numeroFacture'),
                dateFacture=data.get('dateFacture'),
                fournisseur=data.get('fournisseur'),
                adresse=data.get('adresse'),
                categorie=data.get('categorie', 'Autre'),
                lignes=lignes,
                confidence=data.get('confidence', 0.5),
                needsReview=data.get('needsReview', True),
                description=data.get('description'),
                fileType=data.get('fileType'),
                pageCount=data.get('pageCount'),
                warnings=data.get('warnings')
            )
            
            return InvoiceUploadResponse(success=True, data=invoice_data)
        else:
            return InvoiceUploadResponse(success=False, error=result.get('error', 'Erreur inconnue'))
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/invoices/analyze-base64", response_model=InvoiceUploadResponse)
async def analyze_invoice_base64(request: AnalyzeDocumentRequest):
    """Analyze a document from base64"""
    try:
        try:
            file_bytes = base64.b64decode(request.image_base64)
        except Exception as e:
            return InvoiceUploadResponse(success=False, error=f"Erreur base64: {str(e)}")
        
        is_pdf = file_bytes[:4] == b'%PDF'
        file_type = 'pdf' if is_pdf else 'image'
        
        result = await analyze_document(file_bytes, request.filename or '', file_type)
        
        if result.get('success'):
            data = result.get('data', {})
            
            lignes = []
            for ligne in data.get('lignes', []):
                if isinstance(ligne, dict):
                    lignes.append(InvoiceLineItem(**ligne))
            
            invoice_data = InvoiceData(
                montantTotal=data.get('montantTotal'),
                montantHT=data.get('montantHT'),
                montantTVA=data.get('montantTVA'),
                currency=data.get('currency', 'EUR'),
                numeroFacture=data.get('numeroFacture'),
                dateFacture=data.get('dateFacture'),
                fournisseur=data.get('fournisseur'),
                adresse=data.get('adresse'),
                categorie=data.get('categorie', 'Autre'),
                lignes=lignes,
                confidence=data.get('confidence', 0.5),
                needsReview=data.get('needsReview', True),
                description=data.get('description'),
                fileType=data.get('fileType'),
                pageCount=data.get('pageCount'),
                warnings=data.get('warnings')
            )
            
            return InvoiceUploadResponse(success=True, data=invoice_data)
        else:
            return InvoiceUploadResponse(success=False, error=result.get('error', 'Erreur inconnue'))
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============ EXPORT PDF ENDPOINT ============

@router.get("/documents/export/pdf")
async def export_documents_pdf(
    request: Request,
    userId: Optional[str] = None,
    category: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    period: Optional[str] = None
):
    """Export documents as PDF. SECURITY FIX: Filter by auth user."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    from datetime import date
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    
    # Use explicit userId (staff) or authenticated user — resolve ObjectId if needed
    if userId:
        try:
            player_doc = await db.users.find_one(
                {"_id": ObjectId(userId)}, {"_id": 0, "user_id": 1}
            )
            target_user_id = player_doc["user_id"] if player_doc and player_doc.get("user_id") else userId
        except Exception:
            target_user_id = userId
    else:
        target_user_id = await get_current_user_id(request)

    query = {"userId": target_user_id}
    if category:
        query["category"] = category
    
    # Handle period filter
    today = date.today()
    if period == "month":
        startDate = today.replace(day=1).strftime("%d/%m/%Y")
        if today.month == 12:
            endDate = today.replace(year=today.year + 1, month=1, day=1).strftime("%d/%m/%Y")
        else:
            endDate = today.replace(month=today.month + 1, day=1).strftime("%d/%m/%Y")
    elif period == "year":
        startDate = f"01/01/{today.year}"
        endDate = f"31/12/{today.year}"
    
    if startDate or endDate:
        date_query = {}
        if startDate:
            date_query["$gte"] = startDate
        if endDate:
            date_query["$lte"] = endDate
        if date_query:
            query["dateFacture"] = date_query
    
    # Fetch documents
    cursor = db.documents.find(query, {"fileBase64": 0}).sort("dateFacture", -1)
    documents = await cursor.to_list(length=1000)
    
    # Generate PDF
    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=2*cm, bottomMargin=2*cm)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#1976d2'), spaceAfter=20)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.grey, spaceAfter=10)
    
    elements = []
    
    # Title
    elements.append(Paragraph("Rapport de Dépenses", title_style))
    
    # Subtitle with date range
    date_range = ""
    if startDate and endDate:
        date_range = f"Période: {startDate} - {endDate}"
    elif startDate:
        date_range = f"À partir de: {startDate}"
    elif endDate:
        date_range = f"Jusqu'à: {endDate}"
    else:
        date_range = "Toutes les dépenses"
    
    elements.append(Paragraph(f"{date_range} | Généré le {today.strftime('%d/%m/%Y')}", subtitle_style))
    elements.append(Spacer(1, 20))
    
    if not documents:
        elements.append(Paragraph("Aucun document trouvé pour cette période.", styles['Normal']))
    else:
        # Summary by category
        category_totals = {}
        total_general = 0
        
        for doc in documents:
            cat = doc.get("category", "other")
            amount = doc.get("montantTotal", 0) or 0
            category_totals[cat] = category_totals.get(cat, 0) + amount
            total_general += amount
        
        # Summary table
        elements.append(Paragraph("Résumé par catégorie", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        category_labels = {
            'travel': 'Transport',
            'invoices': 'Factures',
            'medical': 'Médical',
            'other': 'Autre'
        }
        
        summary_data = [['Catégorie', 'Total']]
        for cat, total in sorted(category_totals.items()):
            summary_data.append([category_labels.get(cat, cat), f"{total:.2f} €"])
        summary_data.append(['TOTAL GÉNÉRAL', f"{total_general:.2f} €"])
        
        summary_table = Table(summary_data, colWidths=[10*cm, 5*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e3f2fd')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Detail table
        elements.append(Paragraph("Détail des dépenses", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        detail_data = [['Date', 'Fournisseur', 'Catégorie', 'Montant']]
        for doc in documents:
            detail_data.append([
                doc.get("dateFacture", "--"),
                (doc.get("fournisseur") or doc.get("name", "--"))[:30],
                category_labels.get(doc.get("category", "other"), "Autre"),
                f"{doc.get('montantTotal', 0) or 0:.2f} €"
            ])
        
        detail_table = Table(detail_data, colWidths=[3*cm, 7*cm, 3*cm, 3*cm])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ]))
        elements.append(detail_table)
    
    # Build PDF
    pdf_doc.build(elements)
    buffer.seek(0)
    
    filename = f"depenses_{today.strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
