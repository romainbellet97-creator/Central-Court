"""
Tournament API Endpoints Tests
Tests for tournament listing, filtering by circuit, user preferences, weeks grouping, and registration.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com').rstrip('/')

# Test credentials from main agent
TEST_USER_ID = "698aaef916877c9eb27fdeb4"
TEST_TOURNAMENT_ID = "united-cup-2026"


class TestTournamentStats:
    """Tests for GET /api/tournaments/stats endpoint"""
    
    def test_stats_returns_correct_total(self):
        """Verify stats endpoint returns total of 228 tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total" in data
        assert data["total"] == 228
    
    def test_stats_returns_correct_circuit_breakdown(self):
        """Verify stats endpoint returns correct breakdown by circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "byCircuit" in data
        
        by_circuit = data["byCircuit"]
        assert by_circuit.get("ATP") == 60
        assert by_circuit.get("WTA") == 52
        assert by_circuit.get("ITF") == 116
    
    def test_stats_circuit_sum_equals_total(self):
        """Verify sum of circuits equals total"""
        response = requests.get(f"{BASE_URL}/api/tournaments/stats")
        assert response.status_code == 200
        
        data = response.json()
        circuit_sum = sum(data["byCircuit"].values())
        assert circuit_sum == data["total"]


class TestTournamentListFiltering:
    """Tests for GET /api/tournaments with circuit filtering"""
    
    def test_list_atp_tournaments_only(self):
        """Filter tournaments by ATP circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify all returned tournaments are ATP
        for tournament in data:
            assert tournament["circuit"] == "ATP"
    
    def test_list_wta_tournaments_only(self):
        """Filter tournaments by WTA circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=WTA")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify all returned tournaments are WTA
        for tournament in data:
            assert tournament["circuit"] == "WTA"
    
    def test_list_itf_tournaments_only(self):
        """Filter tournaments by ITF circuit (wheelchair)"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ITF")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify all returned tournaments are ITF
        for tournament in data:
            assert tournament["circuit"] == "ITF"
    
    def test_list_multiple_circuits_atp_wta(self):
        """Filter tournaments by multiple circuits (ATP,WTA)"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP,WTA")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify all returned tournaments are either ATP or WTA
        circuits_found = set()
        for tournament in data:
            assert tournament["circuit"] in ["ATP", "WTA"]
            circuits_found.add(tournament["circuit"])
        
        # Should have both circuits
        assert "ATP" in circuits_found
        assert "WTA" in circuits_found
    
    def test_list_all_circuits(self):
        """Filter tournaments by all circuits (ATP,WTA,ITF)"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP,WTA,ITF&limit=300")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify all circuits are present
        circuits_found = set(t["circuit"] for t in data)
        assert "ATP" in circuits_found
        assert "WTA" in circuits_found
        assert "ITF" in circuits_found
    
    def test_list_tournaments_without_filter(self):
        """List tournaments without circuit filter returns all"""
        response = requests.get(f"{BASE_URL}/api/tournaments?limit=300")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 100  # Should have many tournaments
    
    def test_list_tournaments_with_limit(self):
        """Test limit parameter works correctly"""
        response = requests.get(f"{BASE_URL}/api/tournaments?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5
    
    def test_list_tournaments_with_skip(self):
        """Test skip parameter works correctly"""
        # Get first 5
        response1 = requests.get(f"{BASE_URL}/api/tournaments?limit=5&skip=0")
        data1 = response1.json()
        
        # Get next 5
        response2 = requests.get(f"{BASE_URL}/api/tournaments?limit=5&skip=5")
        data2 = response2.json()
        
        # Verify different tournaments
        ids1 = set(t["id"] for t in data1)
        ids2 = set(t["id"] for t in data2)
        assert ids1.isdisjoint(ids2)  # No overlap


class TestTournamentDataStructure:
    """Tests for tournament data structure and fields"""
    
    def test_tournament_has_required_fields(self):
        """Verify tournament objects have all required fields"""
        response = requests.get(f"{BASE_URL}/api/tournaments?limit=1")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        tournament = data[0]
        required_fields = [
            "id", "name", "circuit", "category", "surface",
            "startDate", "endDate", "week", "city", "country",
            "indoor", "prizeMoney", "currency", "points",
            "drawSingles", "drawDoubles", "year"
        ]
        
        for field in required_fields:
            assert field in tournament, f"Missing field: {field}"
    
    def test_atp_tournament_structure(self):
        """Verify ATP tournament has correct structure"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=1")
        assert response.status_code == 200
        
        data = response.json()
        tournament = data[0]
        
        assert tournament["circuit"] == "ATP"
        assert tournament["year"] == 2026
        assert isinstance(tournament["prizeMoney"], (int, float))
        assert isinstance(tournament["points"], int)
    
    def test_itf_tournament_has_urls(self):
        """Verify ITF tournaments have tournament and signup URLs"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ITF&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        
        # At least some ITF tournaments should have URLs
        has_tournament_url = any(t.get("tournamentUrl") for t in data)
        has_signup_link = any(t.get("signUpLink") for t in data)
        
        assert has_tournament_url, "ITF tournaments should have tournamentUrl"
        assert has_signup_link, "ITF tournaments should have signUpLink"


class TestUserTournaments:
    """Tests for GET /api/tournaments/user/{user_id} endpoint"""
    
    def test_user_tournaments_valid_user(self):
        """Get tournaments for valid user based on circuit preferences"""
        response = requests.get(f"{BASE_URL}/api/tournaments/user/{TEST_USER_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # User should have tournaments based on their circuit preferences
    
    def test_user_tournaments_invalid_user_id(self):
        """Invalid user ID returns 400"""
        response = requests.get(f"{BASE_URL}/api/tournaments/user/invalid-id")
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
    
    def test_user_tournaments_nonexistent_user(self):
        """Non-existent user returns 404"""
        # Valid ObjectId format but doesn't exist
        response = requests.get(f"{BASE_URL}/api/tournaments/user/000000000000000000000000")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_user_tournaments_returns_sorted_by_date(self):
        """User tournaments should be sorted by start date"""
        response = requests.get(f"{BASE_URL}/api/tournaments/user/{TEST_USER_ID}?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) > 1:
            dates = [t["startDate"] for t in data]
            assert dates == sorted(dates), "Tournaments should be sorted by startDate"


class TestTournamentWeeks:
    """Tests for GET /api/tournaments/weeks endpoint"""
    
    def test_weeks_returns_grouped_tournaments(self):
        """Verify weeks endpoint returns tournaments grouped by week"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert "weeks" in data
        assert "totalTournaments" in data
        assert isinstance(data["weeks"], list)
    
    def test_weeks_structure(self):
        """Verify week structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        weeks = data["weeks"]
        
        if len(weeks) > 0:
            week = weeks[0]
            assert "weekNumber" in week
            assert "startDate" in week
            assert "tournaments" in week
            assert isinstance(week["tournaments"], list)
    
    def test_weeks_tournament_has_registration_and_hidden(self):
        """Verify tournaments in weeks have registration and hidden fields"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        weeks = data["weeks"]
        
        if len(weeks) > 0 and len(weeks[0]["tournaments"]) > 0:
            tournament = weeks[0]["tournaments"][0]
            assert "registration" in tournament
            assert "hidden" in tournament
    
    def test_weeks_filter_by_atp(self):
        """Filter weeks by ATP circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert data["totalTournaments"] == 60
        
        # Verify all tournaments are ATP
        for week in data["weeks"]:
            for tournament in week["tournaments"]:
                assert tournament["circuit"] == "ATP"
    
    def test_weeks_filter_by_wta(self):
        """Filter weeks by WTA circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=WTA")
        assert response.status_code == 200
        
        data = response.json()
        assert data["totalTournaments"] == 52
        
        # Verify all tournaments are WTA
        for week in data["weeks"]:
            for tournament in week["tournaments"]:
                assert tournament["circuit"] == "WTA"
    
    def test_weeks_filter_by_itf(self):
        """Filter weeks by ITF circuit"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ITF")
        assert response.status_code == 200
        
        data = response.json()
        assert data["totalTournaments"] == 116
        
        # Verify all tournaments are ITF
        for week in data["weeks"]:
            for tournament in week["tournaments"]:
                assert tournament["circuit"] == "ITF"
    
    def test_weeks_filter_by_multiple_circuits(self):
        """Filter weeks by multiple circuits"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP,WTA")
        assert response.status_code == 200
        
        data = response.json()
        assert data["totalTournaments"] == 112  # 60 ATP + 52 WTA
        
        # Verify all tournaments are ATP or WTA
        for week in data["weeks"]:
            for tournament in week["tournaments"]:
                assert tournament["circuit"] in ["ATP", "WTA"]


class TestTournamentRegistration:
    """Tests for POST /api/tournaments/register endpoint"""
    
    def test_register_interested_status(self):
        """Register for tournament with 'interested' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "interested"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["tournamentId"] == TEST_TOURNAMENT_ID
        assert data["status"] == "interested"
    
    def test_register_pending_status(self):
        """Register for tournament with 'pending' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "pending"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "pending"
    
    def test_register_accepted_status(self):
        """Register for tournament with 'accepted' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "accepted"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "accepted"
    
    def test_register_participating_status(self):
        """Register for tournament with 'participating' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "participating"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "participating"
    
    def test_register_declined_status(self):
        """Register for tournament with 'declined' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "declined"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "declined"
    
    def test_register_invalid_status(self):
        """Invalid status returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "invalid_status"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
    
    def test_register_nonexistent_tournament(self):
        """Non-existent tournament returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": "nonexistent-tournament-id", "status": "interested"}
        )
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_register_missing_tournament_id(self):
        """Missing tournamentId returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"status": "interested"}
        )
        assert response.status_code == 422
    
    def test_register_missing_status(self):
        """Missing status returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID}
        )
        assert response.status_code == 422


class TestTournamentHide:
    """Tests for POST /api/tournaments/hide endpoint"""
    
    def test_hide_tournament(self):
        """Hide a tournament"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": "brisbane-2026"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
    
    def test_unhide_tournament(self):
        """Unhide a tournament"""
        # First hide
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": "brisbane-2026"}
        )
        
        # Then unhide
        response = requests.delete(f"{BASE_URL}/api/tournaments/hide/brisbane-2026")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True


class TestTournamentCountVerification:
    """Verify tournament counts match expected values"""
    
    def test_atp_count_is_60(self):
        """Verify ATP has exactly 60 tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=500")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 60
    
    def test_wta_count_is_52(self):
        """Verify WTA has exactly 52 tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=WTA&limit=500")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 52
    
    def test_itf_count_is_116(self):
        """Verify ITF has exactly 116 tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ITF&limit=500")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 116
    
    def test_total_count_is_228(self):
        """Verify total is exactly 228 tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?limit=500")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 228


class TestTournamentFilters:
    """Tests for additional tournament filters"""
    
    def test_filter_by_surface_hard(self):
        """Filter tournaments by Hard surface"""
        response = requests.get(f"{BASE_URL}/api/tournaments?surface=Hard&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for tournament in data:
            assert "hard" in tournament["surface"].lower()
    
    def test_filter_by_surface_clay(self):
        """Filter tournaments by Clay surface"""
        response = requests.get(f"{BASE_URL}/api/tournaments?surface=Clay&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for tournament in data:
            assert "clay" in tournament["surface"].lower()
    
    def test_filter_by_country(self):
        """Filter tournaments by country"""
        response = requests.get(f"{BASE_URL}/api/tournaments?country=Australia&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for tournament in data:
            assert "australia" in tournament["country"].lower()
    
    def test_filter_by_week(self):
        """Filter tournaments by week number"""
        response = requests.get(f"{BASE_URL}/api/tournaments?week=1&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for tournament in data:
            assert tournament["week"] == 1
    
    def test_filter_by_category(self):
        """Filter tournaments by category"""
        response = requests.get(f"{BASE_URL}/api/tournaments?category=Grand%20Slam&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0
        
        for tournament in data:
            assert "grand slam" in tournament["category"].lower()
    
    def test_combined_filters(self):
        """Test combining multiple filters"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&surface=Clay&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert tournament["circuit"] == "ATP"
            assert "clay" in tournament["surface"].lower()


# Cleanup fixture to reset test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_registrations():
    """Cleanup test registrations after all tests"""
    yield
    # Reset registration for test tournament
    try:
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID, "status": "interested"}
        )
        # Unhide any hidden tournaments
        requests.delete(f"{BASE_URL}/api/tournaments/hide/brisbane-2026")
    except:
        pass
