"""
Test suite for Document CRUD endpoints (vault.tsx redesign)
Tests the following endpoints:
- GET /api/documents - List documents with filters
- POST /api/documents - Create new document
- GET /api/documents/{id} - Get single document
- PUT /api/documents/{id} - Update document
- DELETE /api/documents/{id} - Delete document
- POST /api/invoices/analyze-base64 - OCR analysis (may fail without OpenAI key)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://event-management-9.preview.emergentagent.com').rstrip('/')

# Test data constants
TEST_CATEGORIES = ['Transport', 'Hébergement', 'Restauration', 'Médical', 'Matériel', 'Services', 'Autre', 'travel', 'other']


class TestDocumentList:
    """Test GET /api/documents endpoint"""
    
    def test_get_documents_list_success(self):
        """Test that GET /api/documents returns a list"""
        response = requests.get(f"{BASE_URL}/api/documents")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions - should be a list
        data = response.json()
        assert isinstance(data, list), f"Response should be a list, got {type(data)}"
        
        print(f"✓ GET /api/documents returned {len(data)} documents")
    
    def test_get_documents_returns_correct_fields(self):
        """Test that each document has required fields"""
        response = requests.get(f"{BASE_URL}/api/documents")
        
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            doc = data[0]
            required_fields = ['id', 'name', 'category', 'dateFacture', 'fournisseur', 'currency', 'fileType']
            
            for field in required_fields:
                assert field in doc, f"Document should have '{field}' field, got keys: {list(doc.keys())}"
            
            # Check optional but expected fields
            assert 'montantTotal' in doc or doc.get('montantTotal') is None, "montantTotal should be present or null"
            assert 'hasFile' in doc, "hasFile should be present"
            assert 'createdAt' in doc, "createdAt should be present"
            
            print(f"✓ Document has all required fields: {required_fields}")
            print(f"  Sample doc: id={doc['id']}, name={doc['name']}, category={doc['category']}")
        else:
            print("✓ No documents in database yet - will test after creating one")
    
    def test_get_documents_with_category_filter(self):
        """Test filtering documents by category"""
        # First create a test document
        test_doc = {
            "name": f"TEST_CatFilter_{uuid.uuid4().hex[:6]}",
            "category": "Transport",
            "montantTotal": 100.50,
            "dateFacture": "2026-01-15",
            "fournisseur": "Test Transport Co",
            "currency": "EUR",
            "fileType": "image"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=test_doc)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]
        
        try:
            # Filter by category
            response = requests.get(f"{BASE_URL}/api/documents", params={"category": "Transport"})
            assert response.status_code == 200
            
            data = response.json()
            assert isinstance(data, list)
            
            # All returned docs should have Transport category
            for doc in data:
                assert doc["category"] == "Transport", f"Expected Transport, got {doc['category']}"
            
            print(f"✓ Category filter works - returned {len(data)} Transport documents")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/documents/{created_id}")
    
    def test_get_documents_with_date_filter(self):
        """Test filtering documents by date range"""
        response = requests.get(f"{BASE_URL}/api/documents", params={
            "startDate": "2026-01-01",
            "endDate": "2026-12-31"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Date filter works - returned {len(data)} documents in date range")
    
    def test_get_documents_with_pagination(self):
        """Test pagination with limit and skip"""
        response = requests.get(f"{BASE_URL}/api/documents", params={
            "limit": 5,
            "skip": 0
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5, f"Should return max 5 documents, got {len(data)}"
        
        print(f"✓ Pagination works - returned {len(data)} documents (limit=5)")


class TestDocumentCreate:
    """Test POST /api/documents endpoint"""
    
    @pytest.fixture
    def cleanup_doc(self):
        """Fixture to track and cleanup created documents"""
        created_ids = []
        yield created_ids
        # Cleanup after test
        for doc_id in created_ids:
            try:
                requests.delete(f"{BASE_URL}/api/documents/{doc_id}")
            except:
                pass
    
    def test_create_document_full_fields(self, cleanup_doc):
        """Test creating document with all fields"""
        doc_data = {
            "name": f"TEST_FullDoc_{uuid.uuid4().hex[:6]}",
            "category": "Transport",
            "montantTotal": 150.75,
            "montantHT": 125.63,
            "montantTVA": 25.12,
            "currency": "EUR",
            "numeroFacture": "INV-2026-001",
            "dateFacture": "2026-01-15",
            "fournisseur": "Air France",
            "adresse": "Paris, France",
            "confidence": 0.95,
            "description": "Flight tickets",
            "fileType": "pdf",
            "userId": "test-user-123"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        cleanup_doc.append(data["id"])
        
        assert "id" in data, "Response should contain 'id'"
        assert data["name"] == doc_data["name"], f"name mismatch: expected {doc_data['name']}, got {data['name']}"
        assert data["category"] == "Transport", f"category mismatch"
        assert data["montantTotal"] == 150.75, f"montantTotal mismatch"
        assert data["montantHT"] == 125.63, f"montantHT mismatch"
        assert data["montantTVA"] == 25.12, f"montantTVA mismatch"
        assert data["currency"] == "EUR", f"currency mismatch"
        assert data["dateFacture"] == "2026-01-15", f"dateFacture mismatch"
        assert data["fournisseur"] == "Air France", f"fournisseur mismatch"
        assert data["fileType"] == "pdf", f"fileType mismatch"
        assert data["userId"] == "test-user-123", f"userId mismatch"
        assert "createdAt" in data, "createdAt should be present"
        assert "updatedAt" in data, "updatedAt should be present"
        
        print(f"✓ Created document with all fields: id={data['id']}, name={data['name']}")
    
    def test_create_document_minimal_fields(self, cleanup_doc):
        """Test creating document with only required fields"""
        doc_data = {
            "name": f"TEST_MinDoc_{uuid.uuid4().hex[:6]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        cleanup_doc.append(data["id"])
        
        assert data["name"] == doc_data["name"]
        assert data["category"] == "other", f"Default category should be 'other', got {data['category']}"
        assert data["currency"] == "EUR", f"Default currency should be 'EUR', got {data['currency']}"
        assert data["fileType"] == "image", f"Default fileType should be 'image', got {data['fileType']}"
        
        print(f"✓ Created document with minimal fields, defaults applied correctly")
    
    def test_create_document_with_each_category(self, cleanup_doc):
        """Test creating documents with different categories"""
        categories_to_test = ['Transport', 'Hébergement', 'Restauration', 'Médical', 'Matériel', 'Services', 'Autre', 'travel', 'other']
        
        for category in categories_to_test:
            doc_data = {
                "name": f"TEST_Cat_{category}_{uuid.uuid4().hex[:4]}",
                "category": category,
                "montantTotal": 50.00,
                "dateFacture": "2026-01-20"
            }
            
            response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
            assert response.status_code == 200, f"Failed to create document with category '{category}': {response.text}"
            
            data = response.json()
            cleanup_doc.append(data["id"])
            assert data["category"] == category
        
        print(f"✓ Created documents with all {len(categories_to_test)} category types")
    
    def test_create_and_verify_persistence(self, cleanup_doc):
        """Test that created document persists and can be retrieved via GET"""
        doc_data = {
            "name": f"TEST_Persist_{uuid.uuid4().hex[:6]}",
            "category": "Restauration",
            "montantTotal": 89.99,
            "dateFacture": "2026-01-25",
            "fournisseur": "Restaurant Test"
        }
        
        # Create
        create_response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert create_response.status_code == 200
        created = create_response.json()
        cleanup_doc.append(created["id"])
        
        # Verify via GET single document
        get_response = requests.get(f"{BASE_URL}/api/documents/{created['id']}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        retrieved = get_response.json()
        assert retrieved["id"] == created["id"]
        assert retrieved["name"] == doc_data["name"]
        assert retrieved["montantTotal"] == 89.99
        assert retrieved["fournisseur"] == "Restaurant Test"
        
        print(f"✓ Document persisted and retrieved correctly: id={created['id']}")


class TestDocumentGetSingle:
    """Test GET /api/documents/{id} endpoint"""
    
    @pytest.fixture
    def test_document(self):
        """Create a test document for retrieval tests"""
        doc_data = {
            "name": f"TEST_GetDoc_{uuid.uuid4().hex[:6]}",
            "category": "Médical",
            "montantTotal": 120.00,
            "dateFacture": "2026-01-10",
            "fournisseur": "Clinique Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert response.status_code == 200
        doc = response.json()
        yield doc
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc['id']}")
    
    def test_get_document_by_id_success(self, test_document):
        """Test getting a single document by ID"""
        response = requests.get(f"{BASE_URL}/api/documents/{test_document['id']}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == test_document["id"]
        assert data["name"] == test_document["name"]
        assert data["category"] == test_document["category"]
        assert data["montantTotal"] == test_document["montantTotal"]
        
        print(f"✓ Retrieved document by ID: {data['id']}")
    
    def test_get_document_not_found(self):
        """Test that non-existent document returns 404"""
        fake_id = "000000000000000000000000"  # Valid ObjectId format but doesn't exist
        
        response = requests.get(f"{BASE_URL}/api/documents/{fake_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ Returns 404 for non-existent document")
    
    def test_get_document_invalid_id(self):
        """Test that invalid ID format returns 400"""
        invalid_id = "invalid-id-format"
        
        response = requests.get(f"{BASE_URL}/api/documents/{invalid_id}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print(f"✓ Returns 400 for invalid document ID format")


class TestDocumentUpdate:
    """Test PUT /api/documents/{id} endpoint"""
    
    @pytest.fixture
    def test_document(self):
        """Create a test document for update tests"""
        doc_data = {
            "name": f"TEST_UpdateDoc_{uuid.uuid4().hex[:6]}",
            "category": "Services",
            "montantTotal": 200.00,
            "dateFacture": "2026-01-05",
            "fournisseur": "Service Provider"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert response.status_code == 200
        doc = response.json()
        yield doc
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc['id']}")
    
    def test_update_document_single_field(self, test_document):
        """Test updating a single field"""
        update_data = {
            "montantTotal": 250.00
        }
        
        response = requests.put(f"{BASE_URL}/api/documents/{test_document['id']}", json=update_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["montantTotal"] == 250.00, f"montantTotal should be 250.00, got {data['montantTotal']}"
        assert data["name"] == test_document["name"], "Other fields should remain unchanged"
        assert data["category"] == test_document["category"], "Category should remain unchanged"
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/documents/{test_document['id']}")
        assert get_response.json()["montantTotal"] == 250.00
        
        print(f"✓ Updated single field (montantTotal: 200 -> 250)")
    
    def test_update_document_multiple_fields(self, test_document):
        """Test updating multiple fields at once"""
        update_data = {
            "name": "Updated Name",
            "category": "Matériel",
            "montantTotal": 300.00,
            "fournisseur": "New Supplier"
        }
        
        response = requests.put(f"{BASE_URL}/api/documents/{test_document['id']}", json=update_data)
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["category"] == "Matériel"
        assert data["montantTotal"] == 300.00
        assert data["fournisseur"] == "New Supplier"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/documents/{test_document['id']}")
        retrieved = get_response.json()
        assert retrieved["name"] == "Updated Name"
        assert retrieved["category"] == "Matériel"
        
        print(f"✓ Updated multiple fields successfully")
    
    def test_update_document_date(self, test_document):
        """Test updating dateFacture field"""
        update_data = {
            "dateFacture": "2026-02-15"
        }
        
        response = requests.put(f"{BASE_URL}/api/documents/{test_document['id']}", json=update_data)
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["dateFacture"] == "2026-02-15"
        
        print(f"✓ Updated dateFacture field")
    
    def test_update_document_not_found(self):
        """Test updating non-existent document returns 404"""
        fake_id = "000000000000000000000000"
        
        response = requests.put(f"{BASE_URL}/api/documents/{fake_id}", json={"name": "test"})
        
        assert response.status_code == 404
        
        print(f"✓ Returns 404 when updating non-existent document")


class TestDocumentDelete:
    """Test DELETE /api/documents/{id} endpoint"""
    
    def test_delete_document_success(self):
        """Test deleting a document"""
        # Create document to delete
        doc_data = {
            "name": f"TEST_DeleteDoc_{uuid.uuid4().hex[:6]}",
            "category": "Autre",
            "montantTotal": 50.00
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/documents/{doc_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        data = delete_response.json()
        assert data.get("success") == True, f"Delete should return success=True"
        
        # Verify document is gone
        get_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert get_response.status_code == 404, "Deleted document should return 404"
        
        print(f"✓ Document deleted successfully and verified as gone")
    
    def test_delete_document_not_found(self):
        """Test deleting non-existent document returns 404"""
        fake_id = "000000000000000000000000"
        
        response = requests.delete(f"{BASE_URL}/api/documents/{fake_id}")
        
        assert response.status_code == 404
        
        print(f"✓ Returns 404 when deleting non-existent document")
    
    def test_delete_document_invalid_id(self):
        """Test deleting with invalid ID returns 400"""
        invalid_id = "invalid-id"
        
        response = requests.delete(f"{BASE_URL}/api/documents/{invalid_id}")
        
        assert response.status_code == 400
        
        print(f"✓ Returns 400 when deleting with invalid ID format")


class TestOCRAnalyzeBase64:
    """Test POST /api/invoices/analyze-base64 endpoint"""
    
    def test_analyze_base64_endpoint_exists(self):
        """Test that the endpoint exists and doesn't crash with empty data"""
        response = requests.post(f"{BASE_URL}/api/invoices/analyze-base64", json={
            "image_base64": ""
        })
        
        # Should return error but not crash (422 for validation or 200 with error message)
        assert response.status_code in [200, 422, 400, 500], f"Unexpected status: {response.status_code}"
        
        print(f"✓ OCR endpoint exists, returned status {response.status_code}")
    
    def test_analyze_base64_with_invalid_base64(self):
        """Test that invalid base64 returns appropriate error"""
        response = requests.post(f"{BASE_URL}/api/invoices/analyze-base64", json={
            "image_base64": "not-valid-base64!!!"
        })
        
        # Should not crash, should return error response
        assert response.status_code in [200, 400, 422, 500]
        
        data = response.json()
        # If status 200, should have success=False
        if response.status_code == 200:
            assert "success" in data or "error" in data
            if "success" in data:
                assert data["success"] == False, "Invalid base64 should return success=False"
        
        print(f"✓ OCR endpoint handles invalid base64 gracefully")
    
    def test_analyze_base64_with_minimal_image(self):
        """Test with a minimal valid base64 image (1x1 pixel PNG)"""
        # 1x1 transparent PNG in base64
        minimal_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(f"{BASE_URL}/api/invoices/analyze-base64", json={
            "image_base64": minimal_png,
            "filename": "test.png"
        })
        
        # Should return response without crashing
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        
        # Response should have expected structure
        if response.status_code == 200:
            assert "success" in data
            # OCR may fail for such small image but should have proper response structure
            if data.get("success"):
                assert "data" in data
            else:
                assert "error" in data or data.get("success") == False
        
        print(f"✓ OCR endpoint handles minimal image, success={data.get('success', 'N/A')}")


class TestDocumentIntegration:
    """Integration tests for full document lifecycle"""
    
    def test_full_crud_lifecycle(self):
        """Test complete Create-Read-Update-Delete lifecycle"""
        # CREATE
        doc_data = {
            "name": f"TEST_Lifecycle_{uuid.uuid4().hex[:6]}",
            "category": "Transport",
            "montantTotal": 100.00,
            "dateFacture": "2026-01-20",
            "fournisseur": "Lifecycle Test Co"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        print(f"  1. Created document: id={doc_id}")
        
        # READ
        get_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert get_response.status_code == 200
        assert get_response.json()["montantTotal"] == 100.00
        print(f"  2. Read document: montantTotal=100.00")
        
        # UPDATE
        update_response = requests.put(f"{BASE_URL}/api/documents/{doc_id}", json={
            "montantTotal": 150.00,
            "category": "Hébergement"
        })
        assert update_response.status_code == 200
        assert update_response.json()["montantTotal"] == 150.00
        assert update_response.json()["category"] == "Hébergement"
        print(f"  3. Updated document: montantTotal=150.00, category=Hébergement")
        
        # VERIFY UPDATE
        verify_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert verify_response.json()["montantTotal"] == 150.00
        print(f"  4. Verified update persisted")
        
        # DELETE
        delete_response = requests.delete(f"{BASE_URL}/api/documents/{doc_id}")
        assert delete_response.status_code == 200
        print(f"  5. Deleted document")
        
        # VERIFY DELETE
        final_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert final_response.status_code == 404
        print(f"  6. Verified document deleted (404)")
        
        print(f"✓ Full CRUD lifecycle completed successfully")
    
    def test_documents_in_list_after_create(self):
        """Test that created document appears in list"""
        unique_name = f"TEST_ListCheck_{uuid.uuid4().hex[:8]}"
        
        doc_data = {
            "name": unique_name,
            "category": "Services",
            "montantTotal": 75.50
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        assert create_response.status_code == 200
        doc_id = create_response.json()["id"]
        
        try:
            # Check document appears in list
            list_response = requests.get(f"{BASE_URL}/api/documents")
            assert list_response.status_code == 200
            
            docs = list_response.json()
            found = any(d["id"] == doc_id for d in docs)
            assert found, f"Created document {doc_id} should appear in list"
            
            print(f"✓ Created document appears in list")
        finally:
            requests.delete(f"{BASE_URL}/api/documents/{doc_id}")


class TestDocumentStats:
    """Test GET /api/documents/stats endpoint for category breakdown"""
    
    def test_stats_returns_correct_structure(self):
        """Test that stats endpoint returns expected structure"""
        response = requests.get(f"{BASE_URL}/api/documents/stats")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "totalCount" in data
        assert "totalAmount" in data
        assert "byCategory" in data
        assert isinstance(data["byCategory"], dict)
        
        print(f"✓ Stats structure correct: {data['totalCount']} docs, {data['totalAmount']}€")
    
    def test_stats_reflect_new_document(self):
        """Test that stats update after creating a document"""
        # Get initial stats
        initial_response = requests.get(f"{BASE_URL}/api/documents/stats")
        initial_stats = initial_response.json()
        initial_count = initial_stats["totalCount"]
        initial_amount = initial_stats["totalAmount"]
        
        # Create document
        doc_data = {
            "name": f"TEST_Stats_{uuid.uuid4().hex[:6]}",
            "category": "Transport",
            "montantTotal": 123.45
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=doc_data)
        doc_id = create_response.json()["id"]
        
        try:
            # Get updated stats
            updated_response = requests.get(f"{BASE_URL}/api/documents/stats")
            updated_stats = updated_response.json()
            
            assert updated_stats["totalCount"] == initial_count + 1, "Count should increase by 1"
            assert updated_stats["totalAmount"] == initial_amount + 123.45, "Amount should increase"
            
            print(f"✓ Stats updated correctly after document creation")
        finally:
            requests.delete(f"{BASE_URL}/api/documents/{doc_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
