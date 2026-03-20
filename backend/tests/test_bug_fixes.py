"""
Test suite for 4-point bug fix:
1. POST /api/users/onboarding - create new user with all fields including residenceFiscale
2. GET /api/users/profile/email/{email} - get user by email
3. PUT /api/users/profile/{user_id} - update profile (classement, email, residenceFiscale)
4. GET /api/tournaments - tournaments with prizeMoney
5. GET /api/tournaments/weeks - weeks data with prizeMoney
6. GET /api/tournaments/stats - tournament statistics
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com').rstrip('/')


class TestOnboardingCreateUser:
    """Test POST /api/users/onboarding - Bug fix #1: Create new account"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Generate unique test email for each test run"""
        self.test_email = f"TEST_bugfix_{uuid.uuid4().hex[:8]}@test.com"
        self.created_user_id = None
        yield
        # Cleanup: Could delete user if needed
    
    def test_create_user_with_all_fields(self):
        """Test that onboarding creates user with all fields including residenceFiscale"""
        payload = {
            "prenom": "TestPrenom",
            "email": self.test_email,
            "dateNaissance": "1995-05-15",
            "circuits": ["ATP"],
            "niveaux": ["ATP 250", "ATP 500"],
            "classement": "50",
            "residenceFiscale": "Monaco",  # Critical field for bug fix
            "onboardingCompleted": False,
            "onboardingStep": 7
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        
        # Assert status code
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Assert data structure
        data = response.json()
        assert "id" in data, "Response should contain user ID"
        assert data["prenom"] == "TestPrenom"
        assert data["email"] == self.test_email
        assert data["dateNaissance"] == "1995-05-15"
        assert data["circuits"] == ["ATP"]
        assert data["niveaux"] == ["ATP 250", "ATP 500"]
        assert data["classement"] == "50"
        assert data["residenceFiscale"] == "Monaco", "residenceFiscale should be saved"
        assert data["onboardingStep"] == 7
        
        self.created_user_id = data["id"]
        print(f"✓ Created user with ID: {self.created_user_id}")
        print(f"✓ residenceFiscale correctly saved: {data['residenceFiscale']}")
    
    def test_create_user_minimal_fields(self):
        """Test onboarding with minimal required fields"""
        minimal_email = f"TEST_minimal_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "prenom": "MinimalUser",
            "email": minimal_email
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["prenom"] == "MinimalUser"
        assert data["email"] == minimal_email
        assert "id" in data
        print(f"✓ Created user with minimal fields, ID: {data['id']}")
    
    def test_create_user_with_null_residenceFiscale(self):
        """Test that null residenceFiscale is handled properly"""
        null_email = f"TEST_null_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "prenom": "NullResidence",
            "email": null_email,
            "residenceFiscale": None
        }
        
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == null_email
        # residenceFiscale can be null
        print(f"✓ User created with null residenceFiscale handled correctly")


class TestGetUserByEmail:
    """Test GET /api/users/profile/email/{email} - Bug fix #2"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user first"""
        self.test_email = f"TEST_getbyemail_{uuid.uuid4().hex[:8]}@test.com"
        
        # Create user
        payload = {
            "prenom": "GetByEmailTest",
            "email": self.test_email,
            "classement": "100",
            "residenceFiscale": "France"
        }
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200
        self.created_user = response.json()
        yield
    
    def test_get_user_by_email_success(self):
        """Test fetching user profile by email"""
        response = requests.get(f"{BASE_URL}/api/users/profile/email/{self.test_email}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == self.test_email
        assert data["prenom"] == "GetByEmailTest"
        assert data["classement"] == "100"
        assert data["residenceFiscale"] == "France"
        assert data["id"] == self.created_user["id"]
        
        print(f"✓ Successfully retrieved user by email: {self.test_email}")
    
    def test_get_user_by_email_not_found(self):
        """Test 404 for non-existent email"""
        fake_email = "nonexistent_user_12345@test.com"
        response = requests.get(f"{BASE_URL}/api/users/profile/email/{fake_email}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent email")


class TestUpdateProfile:
    """Test PUT /api/users/profile/{user_id} - Bug fix #3: Profile edit saves correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create a test user first"""
        self.test_email = f"TEST_update_{uuid.uuid4().hex[:8]}@test.com"
        
        # Create user
        payload = {
            "prenom": "UpdateTest",
            "email": self.test_email,
            "classement": "50",
            "residenceFiscale": "France"
        }
        response = requests.post(f"{BASE_URL}/api/users/onboarding", json=payload)
        assert response.status_code == 200
        self.user = response.json()
        self.user_id = self.user["id"]
        yield
    
    def test_update_classement(self):
        """Test updating classement field"""
        update_payload = {"classement": "25"}
        
        response = requests.put(f"{BASE_URL}/api/users/profile/{self.user_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["classement"] == "25", "Classement should be updated"
        assert data["prenom"] == "UpdateTest", "Other fields should remain unchanged"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{self.test_email}")
        assert get_response.status_code == 200
        verify_data = get_response.json()
        assert verify_data["classement"] == "25", "Classement should be persisted"
        
        print(f"✓ Successfully updated classement to '25'")
    
    def test_update_residenceFiscale(self):
        """Test updating residenceFiscale field (critical for bug fix)"""
        update_payload = {"residenceFiscale": "Monaco"}
        
        response = requests.put(f"{BASE_URL}/api/users/profile/{self.user_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["residenceFiscale"] == "Monaco", "residenceFiscale should be updated"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{self.test_email}")
        assert get_response.status_code == 200
        verify_data = get_response.json()
        assert verify_data["residenceFiscale"] == "Monaco", "residenceFiscale should be persisted"
        
        print(f"✓ Successfully updated residenceFiscale to 'Monaco'")
    
    def test_update_email(self):
        """Test updating email field"""
        new_email = f"TEST_updated_{uuid.uuid4().hex[:8]}@test.com"
        update_payload = {"email": new_email}
        
        response = requests.put(f"{BASE_URL}/api/users/profile/{self.user_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["email"] == new_email, "Email should be updated"
        
        # Verify with GET using new email
        get_response = requests.get(f"{BASE_URL}/api/users/profile/email/{new_email}")
        assert get_response.status_code == 200
        
        print(f"✓ Successfully updated email to '{new_email}'")
    
    def test_update_multiple_fields(self):
        """Test updating multiple fields at once"""
        update_payload = {
            "classement": "10",
            "residenceFiscale": "Switzerland",
            "prenom": "UpdatedName"
        }
        
        response = requests.put(f"{BASE_URL}/api/users/profile/{self.user_id}", json=update_payload)
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["classement"] == "10"
        assert data["residenceFiscale"] == "Switzerland"
        assert data["prenom"] == "UpdatedName"
        
        print(f"✓ Successfully updated multiple fields at once")
    
    def test_update_no_fields_error(self):
        """Test that empty update returns 400"""
        update_payload = {}
        
        response = requests.put(f"{BASE_URL}/api/users/profile/{self.user_id}", json=update_payload)
        
        assert response.status_code == 400, f"Expected 400 for empty update, got {response.status_code}"
        print("✓ Correctly returns 400 for empty update")
    
    def test_update_invalid_user_id(self):
        """Test 404 for invalid user ID"""
        response = requests.put(f"{BASE_URL}/api/users/profile/invalid_id_123", json={"classement": "5"})
        
        assert response.status_code == 400, f"Expected 400 for invalid ID, got {response.status_code}"
        print("✓ Correctly returns 400 for invalid user ID")
    
    def test_update_nonexistent_user(self):
        """Test 404 for non-existent user"""
        fake_user_id = "000000000000000000000000"
        response = requests.put(f"{BASE_URL}/api/users/profile/{fake_user_id}", json={"classement": "5"})
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Correctly returns 404 for non-existent user")


class TestTournamentsPrizeMoney:
    """Test GET /api/tournaments - Bug fix #4: Display prize money"""
    
    def test_tournaments_list_has_prizeMoney_field(self):
        """Test that tournaments include prizeMoney field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            tournament = data[0]
            assert "prizeMoney" in tournament, "Tournament should have prizeMoney field"
            assert "currency" in tournament, "Tournament should have currency field"
            assert isinstance(tournament["prizeMoney"], (int, float)), "prizeMoney should be numeric"
            
            # Check at least one tournament has prizeMoney > 0
            has_prize_money = any(t.get("prizeMoney", 0) > 0 for t in data)
            if has_prize_money:
                print(f"✓ Found tournaments with prizeMoney > 0")
            else:
                print(f"⚠ No tournaments with prizeMoney > 0 found (may need seed data)")
            
            print(f"✓ Tournaments list includes prizeMoney field")
            print(f"  Example: {tournament.get('name')} - Prize: {tournament.get('prizeMoney')} {tournament.get('currency')}")
        else:
            pytest.skip("No ATP tournaments in database")
    
    def test_tournaments_wta_has_prizeMoney(self):
        """Test WTA tournaments also have prizeMoney"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=WTA&limit=5")
        
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 0:
            tournament = data[0]
            assert "prizeMoney" in tournament
            print(f"✓ WTA tournaments have prizeMoney field")
        else:
            pytest.skip("No WTA tournaments in database")


class TestTournamentWeeksPrizeMoney:
    """Test GET /api/tournaments/weeks - Bug fix #4: Prize money on week cards"""
    
    def test_weeks_endpoint_includes_prizeMoney(self):
        """Test that weeks endpoint includes prizeMoney in tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "weeks" in data, "Response should have 'weeks' key"
        assert "totalTournaments" in data, "Response should have 'totalTournaments' key"
        
        weeks = data["weeks"]
        if len(weeks) > 0:
            week = weeks[0]
            assert "weekNumber" in week
            assert "tournaments" in week
            
            if len(week["tournaments"]) > 0:
                tournament = week["tournaments"][0]
                assert "prizeMoney" in tournament, "Tournament in week should have prizeMoney"
                assert "currency" in tournament, "Tournament in week should have currency"
                
                print(f"✓ Weeks endpoint correctly includes prizeMoney")
                print(f"  Week {week['weekNumber']}: {tournament.get('name')} - Prize: {tournament.get('prizeMoney')} {tournament.get('currency')}")
            else:
                print("⚠ Week has no tournaments")
        else:
            pytest.skip("No weeks data available")
    
    def test_weeks_multiple_circuits(self):
        """Test weeks with multiple circuits filter"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP,WTA")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "weeks" in data
        print(f"✓ Weeks endpoint works with multiple circuits filter")


class TestTournamentStats:
    """Test GET /api/tournaments/stats"""
    
    def test_stats_endpoint(self):
        """Test that stats endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/tournaments/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total" in data, "Stats should have 'total' field"
        assert "byCircuit" in data, "Stats should have 'byCircuit' field"
        assert isinstance(data["total"], int), "total should be an integer"
        assert isinstance(data["byCircuit"], dict), "byCircuit should be a dict"
        
        print(f"✓ Tournament stats: Total={data['total']}, ByCircuit={data['byCircuit']}")


class TestExistingUser:
    """Test with existing user romain@test.com"""
    
    def test_get_existing_user_by_email(self):
        """Test fetching the existing test user"""
        response = requests.get(f"{BASE_URL}/api/users/profile/email/romain@test.com")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Found existing user: {data.get('prenom')} ({data.get('email')})")
            print(f"  Classement: {data.get('classement')}")
            print(f"  residenceFiscale: {data.get('residenceFiscale')}")
        elif response.status_code == 404:
            print("⚠ Existing test user romain@test.com not found - may need to create")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
