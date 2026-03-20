"""
Routes pour la gestion des documents (OCR + CRUD + Export PDF)
Collection MongoDB: documents
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import base64
import io

# Import OCR service
from services.ocr_service import analyze_document, analyze_document_with_ai, suggest_category_from_text
from auth_utils import require_auth

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
        "createdAt": doc.get("createdAt").isoformat() if doc.get("createdAt") else None,
        "updatedAt": doc.get("updatedAt").isoformat() if doc.get("updatedAt") else None,
    }


# ============ CRUD ENDPOINTS ============

@router.post("/documents", response_model=DocumentResponse)
async def create_document(doc: DocumentCreate, user: dict = Depends(require_auth)):
    """Create a new document (userId always taken from session, not request body)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    now = datetime.now(timezone.utc)

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
        "userId": user["user_id"],  # always from session
        "createdAt": now,
        "updatedAt": now,
    }

    result = await db.documents.insert_one(document)
    document["_id"] = result.inserted_id

    return serialize_document(document)


@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(
    category: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    skip: int = Query(default=0, ge=0),
    user: dict = Depends(require_auth)
):
    """Get all documents for the authenticated player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    query = {"userId": user["user_id"]}

    if category:
        query["category"] = category
    
    # Date filtering
    if startDate or endDate:
        date_query = {}
        if startDate:
            date_query["$gte"] = startDate
        if endDate:
            date_query["$lte"] = endDate
        if date_query:
            query["dateFacture"] = date_query
    
    cursor = db.documents.find(query, {"fileBase64": 0}).sort("createdAt", -1).skip(skip).limit(limit)
    documents = await cursor.to_list(length=limit)
    
    return [serialize_document(doc) for doc in documents]


@router.get("/documents/stats")
async def get_documents_stats(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    user: dict = Depends(require_auth)
):
    """Get document statistics for the authenticated player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    query = {"userId": user["user_id"]}
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
async def get_document(document_id: str, user: dict = Depends(require_auth)):
    """Get a single document by ID (must belong to authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)}, {"fileBase64": 0})
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    if not doc or doc.get("userId") != user["user_id"]:
        raise HTTPException(status_code=404, detail="Document not found")

    return serialize_document(doc)


@router.get("/documents/{document_id}/file")
async def get_document_file(document_id: str, user: dict = Depends(require_auth)):
    """Get the original file (image/PDF) of a document (must belong to authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)}, {"fileBase64": 1, "fileType": 1, "name": 1, "userId": 1})
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    if not doc or doc.get("userId") != user["user_id"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
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
async def update_document(document_id: str, update: DocumentUpdate, user: dict = Depends(require_auth)):
    """Update a document (must belong to authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        object_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    update_dict = {k: v for k, v in update.dict(exclude_unset=True).items()}

    if update_dict.get("lignes"):
        update_dict["lignes"] = [l.dict() if hasattr(l, 'dict') else l for l in update_dict["lignes"]]

    update_dict["updatedAt"] = datetime.now(timezone.utc)

    result = await db.documents.update_one(
        {"_id": object_id, "userId": user["user_id"]},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = await db.documents.find_one({"_id": object_id}, {"fileBase64": 0})
    return serialize_document(doc)


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(require_auth)):
    """Delete a document (must belong to authenticated player)"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    try:
        object_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    result = await db.documents.delete_one({"_id": object_id, "userId": user["user_id"]})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"success": True, "message": "Document deleted"}


# ============ OCR ENDPOINTS ============

@router.post("/documents/analyze", response_model=AnalyzeDocumentResponse)
async def analyze_document_endpoint(request: AnalyzeDocumentRequest, user: dict = Depends(require_auth)):
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
async def upload_invoice(file: UploadFile = File(...), user: dict = Depends(require_auth)):
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
async def analyze_invoice_base64(request: AnalyzeDocumentRequest, user: dict = Depends(require_auth)):
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
    category: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    period: Optional[str] = None,  # "month", "year", "all"
    user: dict = Depends(require_auth)
):
    """Export documents as PDF report for the authenticated player"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")

    from datetime import date
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    # Build query scoped to the authenticated player
    query = {"userId": user["user_id"]}
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
