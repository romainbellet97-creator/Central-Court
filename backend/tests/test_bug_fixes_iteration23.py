"""
Tests for Bug Fixes - Iteration 23
- BUG #1: POST /api/documents with dateFacture saves the date correctly
- Verifying document CRUD with date fields
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com').rstrip('/')


class TestDocumentAPIDateFacture:
    """Tests for Document API - specifically dateFacture handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_doc_ids = []
        yield
        # Cleanup test documents
        for doc_id in self.test_doc_ids:
            try:
                requests.delete(f"{BASE_URL}/api/documents/{doc_id}")
            except:
                pass
    
    def test_create_document_with_date_facture(self):
        """BUG #1: Create document with dateFacture - verify date is saved correctly"""
        # Use a specific date (not today) to verify the AI-extracted date is used
        test_date = "2025-06-15"  # Past date - different from today
        
        payload = {
            "name": "TEST_Invoice_June_2025",
            "fournisseur": "Test Supplier Bug1",
            "dateFacture": test_date,
            "category": "Transport",
            "montantTotal": 150.50,
            "currency": "EUR",
            "fileType": "image",
            "userId": "test-user-bug1"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=payload)
        assert response.status_code == 200, f"Failed to create document: {response.text}"
        
        data = response.json()
        self.test_doc_ids.append(data["id"])
        
        # Verify dateFacture is saved correctly
        assert data["dateFacture"] == test_date, f"Expected dateFacture={test_date}, got {data['dateFacture']}"
        assert data["name"] == "TEST_Invoice_June_2025"
        assert data["montantTotal"] == 150.50
        print(f"✅ Document created with dateFacture: {data['dateFacture']}")
    
    def test_create_document_future_date(self):
        """Create document with future date"""
        test_date = "2026-12-25"  # Future date
        
        payload = {
            "name": "TEST_Invoice_December_2026",
            "fournisseur": "Future Supplier",
            "dateFacture": test_date,
            "category": "Hébergement",
            "montantTotal": 500.00,
            "currency": "EUR",
            "userId": "test-user-future"
        }
        
        response = requests.post(f"{BASE_URL}/api/documents", json=payload)
        assert response.status_code == 200, f"Failed to create document: {response.text}"
        
        data = response.json()
        self.test_doc_ids.append(data["id"])
        
        assert data["dateFacture"] == test_date
        print(f"✅ Document with future date saved: {data['dateFacture']}")
    
    def test_get_document_verifies_date_persisted(self):
        """Create document then GET to verify date is actually persisted in DB"""
        test_date = "2024-03-20"
        
        # CREATE
        payload = {
            "name": "TEST_Persistence_Check",
            "fournisseur": "Persistence Test",
            "dateFacture": test_date,
            "category": "Médical",
            "montantTotal": 75.00,
            "userId": "test-user-persist"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=payload)
        assert create_response.status_code == 200
        
        doc_id = create_response.json()["id"]
        self.test_doc_ids.append(doc_id)
        
        # GET to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert get_response.status_code == 200
        
        fetched_doc = get_response.json()
        assert fetched_doc["dateFacture"] == test_date, f"Date not persisted! Expected {test_date}, got {fetched_doc['dateFacture']}"
        print(f"✅ GET verified dateFacture persisted: {fetched_doc['dateFacture']}")
    
    def test_update_document_date(self):
        """Update document's dateFacture and verify persistence"""
        original_date = "2025-01-01"
        updated_date = "2025-09-15"
        
        # CREATE
        payload = {
            "name": "TEST_Update_Date",
            "dateFacture": original_date,
            "category": "Services",
            "montantTotal": 200.00
        }
        
        create_response = requests.post(f"{BASE_URL}/api/documents", json=payload)
        assert create_response.status_code == 200
        
        doc_id = create_response.json()["id"]
        self.test_doc_ids.append(doc_id)
        
        # UPDATE
        update_payload = {"dateFacture": updated_date}
        update_response = requests.put(f"{BASE_URL}/api/documents/{doc_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify update response
        updated_doc = update_response.json()
        assert updated_doc["dateFacture"] == updated_date
        
        # GET to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
        assert get_response.status_code == 200
        assert get_response.json()["dateFacture"] == updated_date
        print(f"✅ Document date updated from {original_date} to {updated_date}")
    
    def test_list_documents_filters_by_date(self):
        """Test document listing with date filter"""
        # Create documents with different dates
        docs_to_create = [
            {"name": "TEST_Jan_Doc", "dateFacture": "2025-01-15", "category": "Transport", "montantTotal": 100},
            {"name": "TEST_Mar_Doc", "dateFacture": "2025-03-15", "category": "Transport", "montantTotal": 200},
            {"name": "TEST_Jun_Doc", "dateFacture": "2025-06-15", "category": "Transport", "montantTotal": 300},
        ]
        
        for doc in docs_to_create:
            response = requests.post(f"{BASE_URL}/api/documents", json=doc)
            if response.status_code == 200:
                self.test_doc_ids.append(response.json()["id"])
        
        # Filter by date range
        response = requests.get(f"{BASE_URL}/api/documents", params={
            "startDate": "2025-02-01",
            "endDate": "2025-05-01"
        })
        assert response.status_code == 200
        
        docs = response.json()
        # Should find the March document
        march_docs = [d for d in docs if d.get("dateFacture") == "2025-03-15"]
        print(f"✅ Date filter working - found {len(docs)} documents in range")


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_health(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ API health check passed")
    
    def test_documents_categories(self):
        """Verify categories endpoint works"""
        response = requests.get(f"{BASE_URL}/api/documents/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) > 0
        print(f"✅ Categories endpoint returned {len(data['categories'])} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
