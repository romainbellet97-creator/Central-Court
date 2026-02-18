"""
Test suite for User Profile and Documents endpoints
Tests the following endpoints:
- GET /api/documents/stats - Document statistics
- GET /api/documents/categories - List of categories
- POST /api/users/onboarding - Create/update user with prenom, email, classement, residenceFiscale
- GET /api/users/profile/email/{email} - Get user profile by email
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://tournytrack.preview.emergentagent.com').rstrip('/')


class TestDocumentsStats:
    """Test /api/documents/stats endpoint"""
    
    def test_get_documents_stats_success(self):
        """Test that /api/documents/stats returns valid statistics"""
        response = requests.get(f"{BASE_URL}/api/documents/stats")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "totalCount" in data, "Response should contain 'totalCount'"
        assert "totalAmount" in data, "Response should contain 'totalAmount'"
        assert "byCategory" in data, "Response should contain 'byCategory'"
        
        # Type assertions
        assert isinstance(data["totalCount"], int), "totalCount should be an integer"
        assert isinstance(data["totalAmount"], (int, float)), "totalAmount should be a number"
        assert isinstance(data["byCategory"], dict), "byCategory should be a dictionary"
        
        print(f"✓ Documents stats: {data['totalCount']} documents, {data['totalAmount']}€ total")
    
    def test_get_documents_stats_with_user_filter(self):
        """Test /api/documents/stats with userId filter"""
        response = requests.get(f"{BASE_URL}/api/documents/stats", params={"userId": "test_user_123"})
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totalCount" in data
        assert "totalAmount" in data
        assert "byCategory" in data
        
        print(f"✓ Documents stats with userId filter works")
    
    def test_get_documents_stats_with_date_filter(self):
        """Test /api/documents/stats with date filters"""
        response = requests.get(f"{BASE_URL}/api/documents/stats", params={
            "startDate": "01/01/2024",
            "endDate": "31/12/2024"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "totalCount" in data
        assert "totalAmount" in data
        
        print(f"✓ Documents stats with date filter works")


class TestDocumentsCategories:
    """Test /api/documents/categories endpoint"""
    
    def test_get_categories_success(self):
        """Test that /api/documents/categories returns valid categories list"""
        response = requests.get(f"{BASE_URL}/api/documents/categories")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "categories" in data, "Response should contain 'categories'"
        assert isinstance(data["categories"], list), "categories should be a list"
        assert len(data["categories"]) > 0, "categories list should not be empty"
        
        # Verify category structure
        for category in data["categories"]:
            assert "id" in category, "Each category should have 'id'"
            assert "label" in category, "Each category should have 'label'"
            assert "icon" in category, "Each category should have 'icon'"
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in data["categories"]]
        expected_categories = ["travel", "accommodation", "restaurant", "medical", "equipment", "services", "other"]
        
        for expected in expected_categories:
            assert expected in category_ids, f"Category '{expected}' should be in the list"
        
        print(f"✓ Categories endpoint returns {len(data['categories'])} categories: {category_ids}")
    
    def test_categories_have_correct_labels(self):
        """Test that categories have correct French labels"""
        response = requests.get(f"{BASE_URL}/api/documents/categories")
        
        assert response.status_code == 200
        
        data = response.json()
        categories = {c["id"]: c["label"] for c in data["categories"]}
        
        # Verify French labels
        expected_labels = {
            "travel": "Transport",
            "accommodation": "Hébergement",
            "restaurant": "Restauration",
            "medical": "Médical",
            "equipment": "Matériel",
            "services": "Services",
            "other": "Autre"
        }
        
        for cat_id, expected_label in expected_labels.items():
            assert categories.get(cat_id) == expected_label, f"Category '{cat_id}' should have label '{expected_label}', got '{categories.get(cat_id)}'"
        
        print(f"✓ All category labels are correct in French")


class TestUserOnboarding:
    """Test /api/users/onboarding endpoint"""
    
    @pytest.fixture
    def unique_email(self):
        """Generate unique email for each test"""
        return f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
    
    def test_create_user_with_all_fields(self, unique_email):
        """Test creating a new user with all required fields including residenceFiscale"""
        payload = {
            "prenom": "TEST_Romain",
            "email": unique_email,
            "classement": "45",
            "residenceFiscale": "Monaco",
            "circuits": ["ATP"],
            "niveaux": ["250", "500"],
            "onboardingCompleted": True,
            "onboardingStep": 7
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["prenom"] == "TEST_Romain", f"prenom should be 'TEST_Romain', got '{data.get('prenom')}'"
        assert data["email"] == unique_email, f"email should be '{unique_email}', got '{data.get('email')}'"
        assert data["classement"] == "45", f"classement should be '45', got '{data.get('classement')}'"
        assert data["residenceFiscale"] == "Monaco", f"residenceFiscale should be 'Monaco', got '{data.get('residenceFiscale')}'"
        assert data["circuits"] == ["ATP"], f"circuits should be ['ATP'], got '{data.get('circuits')}'"
        assert data["onboardingCompleted"] == True, "onboardingCompleted should be True"
        
        print(f"✓ Created user with all fields: {data['prenom']} (#{data['classement']}) - {data['residenceFiscale']}")
        
        # Cleanup - verify user exists via GET
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{unique_email}")
        assert get_response.status_code == 200, "User should be retrievable after creation"
        
        return data
    
    def test_create_user_minimal_fields(self, unique_email):
        """Test creating a user with only required fields"""
        payload = {
            "prenom": "TEST_MinimalUser",
            "email": unique_email
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["prenom"] == "TEST_MinimalUser"
        assert data["email"] == unique_email
        # Optional fields should be None or default
        assert data.get("classement") is None or data.get("classement") == ""
        assert data.get("residenceFiscale") is None or data.get("residenceFiscale") == ""
        
        print(f"✓ Created user with minimal fields: {data['prenom']}")
    
    def test_update_existing_user(self, unique_email):
        """Test updating an existing user via onboarding endpoint"""
        # First create user
        create_payload = {
            "prenom": "TEST_UpdateUser",
            "email": unique_email,
            "classement": "100",
            "residenceFiscale": "France"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users/onboarding", json=create_payload)
        assert create_response.status_code == 200
        
        # Update user with same email
        update_payload = {
            "prenom": "TEST_UpdateUser",
            "email": unique_email,
            "classement": "50",  # Updated ranking
            "residenceFiscale": "Suisse"  # Updated residence
        }
        
        update_response = requests.post(f"{BASE_URL}/api/users/onboarding", json=update_payload)
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["classement"] == "50", f"classement should be updated to '50', got '{data.get('classement')}'"
        assert data["residenceFiscale"] == "Suisse", f"residenceFiscale should be updated to 'Suisse', got '{data.get('residenceFiscale')}'"
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{unique_email}")
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["classement"] == "50"
        assert get_data["residenceFiscale"] == "Suisse"
        
        print(f"✓ Updated user: classement 100→50, residenceFiscale France→Suisse")
    
    def test_create_user_missing_required_fields(self):
        """Test that creating user without required fields fails"""
        # Missing prenom
        payload = {
            "email": "test@test.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Expected 422 for missing prenom, got {response.status_code}"
        
        print(f"✓ Correctly rejects request without required 'prenom' field")


class TestUserProfileByEmail:
    """Test /api/users/profile/email/{email} endpoint"""
    
    @pytest.fixture
    def test_user(self):
        """Create a test user and return its data"""
        unique_email = f"TEST_profile_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "prenom": "TEST_ProfileUser",
            "email": unique_email,
            "classement": "75",
            "residenceFiscale": "Dubaï",
            "circuits": ["WTA"],
            "niveaux": ["1000"],
            "onboardingCompleted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200
        return response.json()
    
    def test_get_profile_by_email_success(self, test_user):
        """Test getting user profile by email returns all fields"""
        email = test_user["email"]
        
        response = requests.get(f"{BASE_URL}/api/users/profile/email/{email}")
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions - verify all fields are returned
        data = response.json()
        assert data["id"] == test_user["id"], "id should match"
        assert data["prenom"] == "TEST_ProfileUser", f"prenom should be 'TEST_ProfileUser', got '{data.get('prenom')}'"
        assert data["email"] == email, f"email should match"
        assert data["classement"] == "75", f"classement should be '75', got '{data.get('classement')}'"
        assert data["residenceFiscale"] == "Dubaï", f"residenceFiscale should be 'Dubaï', got '{data.get('residenceFiscale')}'"
        assert data["circuits"] == ["WTA"], f"circuits should be ['WTA'], got '{data.get('circuits')}'"
        assert data["onboardingCompleted"] == True, "onboardingCompleted should be True"
        
        # Verify timestamps exist
        assert "createdAt" in data, "createdAt should be present"
        assert "updatedAt" in data, "updatedAt should be present"
        
        print(f"✓ Retrieved profile by email: {data['prenom']} (#{data['classement']}) - {data['residenceFiscale']}")
    
    def test_get_profile_by_email_not_found(self):
        """Test getting profile for non-existent email returns 404"""
        fake_email = f"nonexistent_{uuid.uuid4().hex}@test.com"
        
        response = requests.get(f"{BASE_URL}/api/users/profile/email/{fake_email}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent email, got {response.status_code}"
        
        print(f"✓ Correctly returns 404 for non-existent email")
    
    def test_get_profile_by_email_special_characters(self):
        """Test getting profile with special characters in email"""
        # Create user with special email
        special_email = f"TEST_special+tag_{uuid.uuid4().hex[:6]}@test.com"
        payload = {
            "prenom": "TEST_SpecialEmail",
            "email": special_email
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert create_response.status_code == 200
        
        # URL encode the email for the GET request
        import urllib.parse
        encoded_email = urllib.parse.quote(special_email, safe='')
        
        response = requests.get(f"{BASE_URL}/api/users/profile/email/{encoded_email}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["email"] == special_email
        
        print(f"✓ Handles special characters in email correctly")


class TestIntegration:
    """Integration tests for user profile and documents flow"""
    
    def test_full_user_flow(self):
        """Test complete user onboarding and profile retrieval flow"""
        unique_email = f"TEST_integration_{uuid.uuid4().hex[:8]}@test.com"
        
        # Step 1: Create user via onboarding
        create_payload = {
            "prenom": "TEST_IntegrationUser",
            "email": unique_email,
            "classement": "25",
            "residenceFiscale": "Monaco",
            "circuits": ["ATP", "ITF"],
            "niveaux": ["250", "500", "1000"],
            "onboardingCompleted": False,
            "onboardingStep": 3
        }
        
        create_response = requests.post(f"{BASE_URL}/api/users/onboarding", json=create_payload)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        print(f"  Step 1: Created user with id {user_id}")
        
        # Step 2: Retrieve profile by email
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{unique_email}")
        assert get_response.status_code == 200
        profile = get_response.json()
        assert profile["id"] == user_id
        assert profile["classement"] == "25"
        assert profile["residenceFiscale"] == "Monaco"
        print(f"  Step 2: Retrieved profile - {profile['prenom']} (#{profile['classement']})")
        
        # Step 3: Update user (complete onboarding)
        update_payload = {
            "prenom": "TEST_IntegrationUser",
            "email": unique_email,
            "classement": "20",  # Improved ranking
            "residenceFiscale": "Monaco",
            "circuits": ["ATP", "ITF"],
            "niveaux": ["250", "500", "1000"],
            "onboardingCompleted": True,
            "onboardingStep": 7
        }
        
        update_response = requests.post(f"{BASE_URL}/api/users/onboarding", json=update_payload)
        assert update_response.status_code == 200
        updated_profile = update_response.json()
        assert updated_profile["classement"] == "20"
        assert updated_profile["onboardingCompleted"] == True
        print(f"  Step 3: Updated profile - classement now #{updated_profile['classement']}, onboarding complete")
        
        # Step 4: Verify update via GET
        verify_response = requests.get(f"{BASE_URL}/api/users/profile/email/{unique_email}")
        assert verify_response.status_code == 200
        final_profile = verify_response.json()
        assert final_profile["classement"] == "20"
        assert final_profile["onboardingCompleted"] == True
        print(f"  Step 4: Verified final profile state")
        
        print(f"✓ Full user flow completed successfully")
    
    def test_documents_and_categories_available(self):
        """Test that documents stats and categories are available"""
        # Get categories
        cat_response = requests.get(f"{BASE_URL}/api/documents/categories")
        assert cat_response.status_code == 200
        categories = cat_response.json()["categories"]
        print(f"  Categories available: {len(categories)}")
        
        # Get stats
        stats_response = requests.get(f"{BASE_URL}/api/documents/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        print(f"  Documents stats: {stats['totalCount']} docs, {stats['totalAmount']}€")
        
        print(f"✓ Documents endpoints working correctly")


# Test with specific test email from requirements
class TestSpecificUser:
    """Test with the specific test email provided"""
    
    def test_create_or_get_romain_user(self):
        """Test creating/updating user with test email romain@test.com"""
        test_email = "romain@test.com"
        
        # Create/update user
        payload = {
            "prenom": "Romain",
            "email": test_email,
            "classement": "45",
            "residenceFiscale": "Monaco",
            "circuits": ["ATP"],
            "onboardingCompleted": True
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == test_email
        assert data["prenom"] == "Romain"
        assert data["classement"] == "45"
        assert data["residenceFiscale"] == "Monaco"
        
        print(f"✓ User romain@test.com created/updated successfully")
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{test_email}")
        assert get_response.status_code == 200
        
        profile = get_response.json()
        assert profile["residenceFiscale"] == "Monaco", f"residenceFiscale should be 'Monaco', got '{profile.get('residenceFiscale')}'"
        
        print(f"✓ Profile retrieved: {profile['prenom']} (#{profile['classement']}) - {profile['residenceFiscale']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
