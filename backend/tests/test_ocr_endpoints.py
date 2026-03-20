"""
OCR Endpoints Test Suite
Tests for invoice/document analysis endpoints:
- POST /api/invoices/analyze-base64 - Base64 encoded image/PDF analysis
- POST /api/documents/analyze - Legacy endpoint for image analysis
- GET /api/documents/categories - Returns available categories
- POST /api/invoices/upload - Multipart form upload endpoint
"""

import pytest
import requests
import os
import base64
from PIL import Image, ImageDraw
import io

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://multi-tenant-secure-2.preview.emergentagent.com"


def create_test_receipt_image(text_content: str) -> bytes:
    """Create a test receipt image with given text content"""
    img = Image.new('RGB', (400, 500), color='white')
    draw = ImageDraw.Draw(img)
    
    y_position = 20
    for line in text_content.strip().split('\n'):
        draw.text((20, y_position), line, fill='black')
        y_position += 20
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.read()


def create_test_receipt_base64(text_content: str) -> str:
    """Create a test receipt image and return as base64"""
    image_bytes = create_test_receipt_image(text_content)
    return base64.b64encode(image_bytes).decode('utf-8')


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test that health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data


class TestCategoriesEndpoint:
    """Categories endpoint tests"""
    
    def test_get_categories(self):
        """Test GET /api/documents/categories returns all categories"""
        response = requests.get(f"{BASE_URL}/api/documents/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected_ids = ["travel", "accommodation", "restaurant", "medical", "equipment", "services", "other"]
        
        for expected_id in expected_ids:
            assert expected_id in category_ids, f"Missing category: {expected_id}"
        
        # Verify each category has required fields
        for cat in categories:
            assert "id" in cat
            assert "label" in cat
            assert "icon" in cat


class TestInvoiceAnalyzeBase64Endpoint:
    """Tests for POST /api/invoices/analyze-base64 endpoint"""
    
    def test_analyze_restaurant_receipt(self):
        """Test OCR extraction from restaurant receipt"""
        receipt_text = """
RESTAURANT LE TENNIS
123 Rue du Sport
75001 Paris

Date: 15/01/2026

Menu du jour         15.00 EUR
Boisson              3.50 EUR
Dessert              6.00 EUR

------------------------
TOTAL TTC           24.50 EUR
------------------------
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "restaurant_receipt.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify success
        assert data["success"] == True
        assert data["data"] is not None
        
        # Verify extracted data
        invoice_data = data["data"]
        assert invoice_data["montantTotal"] == 24.5
        assert invoice_data["dateFacture"] == "15/01/2026"
        assert invoice_data["fournisseur"] == "RESTAURANT LE TENNIS"
        assert invoice_data["categorie"] == "Restauration"
        assert invoice_data["confidence"] >= 0.7
        
        # Verify line items
        assert invoice_data["lignes"] is not None
        assert len(invoice_data["lignes"]) >= 1
    
    def test_analyze_hotel_receipt_with_ht_tva(self):
        """Test OCR extraction with HT/TVA breakdown"""
        receipt_text = """
HOTEL HILTON PARIS
Avenue des Champs-Elysees
75008 Paris

Date: 20/01/2026
Facture N: HTL-2026-001

Chambre Double      180.00 EUR
Petit-dejeuner       25.00 EUR
Parking              15.00 EUR

------------------------
Sous-total HT       183.33 EUR
TVA (20%)            36.67 EUR
------------------------
TOTAL TTC           220.00 EUR
------------------------
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "hotel_receipt.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        invoice_data = data["data"]
        
        # Verify amounts
        assert invoice_data["montantTotal"] == 220.0
        assert invoice_data["montantHT"] == 183.33
        assert invoice_data["montantTVA"] == 36.67
        
        # Verify HT + TVA = TTC (within tolerance)
        if invoice_data["montantHT"] and invoice_data["montantTVA"]:
            calculated = invoice_data["montantHT"] + invoice_data["montantTVA"]
            assert abs(calculated - invoice_data["montantTotal"]) < 0.10
        
        # Verify category detection
        assert invoice_data["categorie"] == "Hébergement"
        
        # Verify invoice number
        assert invoice_data["numeroFacture"] == "HTL-2026-001"
    
    def test_analyze_medical_receipt(self):
        """Test OCR extraction from medical receipt"""
        receipt_text = """
PHARMACIE CENTRALE
45 Boulevard de la Sante
75013 Paris

Date: 10/01/2026

Medicament A         12.50 EUR
Medicament B          8.00 EUR
Pansements            4.50 EUR

------------------------
TOTAL                25.00 EUR
------------------------
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "pharmacy_receipt.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        invoice_data = data["data"]
        
        # Verify medical category detection
        assert invoice_data["categorie"] == "Médical"
        assert invoice_data["montantTotal"] == 25.0
    
    def test_analyze_travel_receipt(self):
        """Test OCR extraction from travel receipt"""
        receipt_text = """
AIR FRANCE
Billet Electronique

Date: 05/01/2026
Vol: AF1234

Paris CDG -> Rotterdam
Classe Economique

------------------------
TOTAL TTC           285.00 EUR
------------------------
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "flight_ticket.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        invoice_data = data["data"]
        
        # Verify transport category detection
        assert invoice_data["categorie"] == "Transport"
        assert invoice_data["montantTotal"] == 285.0
    
    def test_invalid_base64(self):
        """Test error handling for invalid base64"""
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": "invalid_base64_data!!!", "filename": "test.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert data["error"] is not None


class TestDocumentsAnalyzeEndpoint:
    """Tests for legacy POST /api/documents/analyze endpoint"""
    
    def test_legacy_analyze_endpoint(self):
        """Test legacy endpoint returns old format"""
        receipt_text = """
RESTAURANT TEST
Date: 01/01/2026
TOTAL: 50.00 EUR
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/documents/analyze",
            json={"image_base64": base64_image, "filename": "test.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify legacy format fields
        assert "success" in data
        assert "amount" in data
        assert "date" in data
        assert "category" in data
        assert "merchant" in data
        assert "confidence" in data
        assert "needsReview" in data


class TestInvoiceUploadEndpoint:
    """Tests for POST /api/invoices/upload multipart endpoint"""
    
    def test_upload_png_image(self):
        """Test multipart upload with PNG image"""
        receipt_text = """
TEST STORE
Date: 25/01/2026
TOTAL: 99.99 EUR
"""
        image_bytes = create_test_receipt_image(receipt_text)
        
        files = {
            'file': ('test_receipt.png', image_bytes, 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/upload",
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"] is not None
        assert data["data"]["montantTotal"] == 99.99
        assert data["data"]["fileType"] == "image"
    
    def test_upload_jpeg_image(self):
        """Test multipart upload with JPEG image"""
        receipt_text = """
JPEG TEST STORE
Date: 26/01/2026
TOTAL: 75.50 EUR
"""
        # Create JPEG image
        img = Image.new('RGB', (400, 300), color='white')
        draw = ImageDraw.Draw(img)
        y_position = 20
        for line in receipt_text.strip().split('\n'):
            draw.text((20, y_position), line, fill='black')
            y_position += 20
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=90)
        buffer.seek(0)
        image_bytes = buffer.read()
        
        files = {
            'file': ('test_receipt.jpg', image_bytes, 'image/jpeg')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/upload",
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data"]["montantTotal"] == 75.5
    
    def test_upload_empty_file(self):
        """Test error handling for empty file"""
        files = {
            'file': ('empty.png', b'', 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/upload",
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == False
        assert "vide" in data["error"].lower() or "empty" in data["error"].lower()


class TestOCRDataValidation:
    """Tests for OCR data validation rules"""
    
    def test_confidence_score_range(self):
        """Test that confidence score is between 0 and 1"""
        receipt_text = """
CLEAR RECEIPT
Date: 01/01/2026
TOTAL: 100.00 EUR
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "test.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["success"]:
            confidence = data["data"]["confidence"]
            assert 0 <= confidence <= 1
    
    def test_needs_review_flag(self):
        """Test that needsReview flag is set appropriately"""
        receipt_text = """
CLEAR RECEIPT
Date: 01/01/2026
TOTAL: 100.00 EUR
"""
        base64_image = create_test_receipt_base64(receipt_text)
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/analyze-base64",
            json={"image_base64": base64_image, "filename": "test.png"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["success"]:
            assert "needsReview" in data["data"]
            assert isinstance(data["data"]["needsReview"], bool)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
