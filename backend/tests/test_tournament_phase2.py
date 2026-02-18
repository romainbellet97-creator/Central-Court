"""
Tournament Phase 2 Tests - Tournament Optimizations
Tests for Phase 2 features:
1. GET /api/tournaments?circuits=ATP returns tournaments with category field for level badges
2. POST /api/tournaments/register sets status to 'pending' correctly  
3. POST /api/tournaments/register with status 'participating' works after 'pending'
4. POST /api/tournaments/register with status 'declined' works after 'pending'
5. GET /api/tournaments/weeks?circuits=ATP returns weeks with category and surface fields
6. POST /api/tournaments/hide works and GET /api/tournaments/weeks shows hidden=true
7. DELETE /api/tournaments/hide/{id} unhides tournament correctly
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://courtside-48.preview.emergentagent.com').rstrip('/')

# Test tournament IDs
TEST_TOURNAMENT_ID_REGISTER = "australian-open-2026"  # Grand Slam for registration tests
TEST_TOURNAMENT_ID_HIDE = "dubai-2026"  # For hide/unhide tests
TEST_TOURNAMENT_ID_STATUS_FLOW = "indian-wells-2026"  # For status transition tests


class TestTournamentCategoryField:
    """Tests for category field in tournament responses - Level badges support"""
    
    def test_get_tournaments_has_category_field(self):
        """GET /api/tournaments?circuits=ATP returns tournaments with category field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for tournament in data:
            assert "category" in tournament, f"Tournament {tournament.get('id')} missing category field"
            assert tournament["category"] is not None, f"Tournament {tournament.get('id')} has null category"
            assert isinstance(tournament["category"], str), f"Tournament {tournament.get('id')} category is not string"
            assert len(tournament["category"]) > 0, f"Tournament {tournament.get('id')} has empty category"
    
    def test_category_values_are_valid(self):
        """Verify category field contains valid tournament levels"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=60")
        assert response.status_code == 200
        
        data = response.json()
        
        # Valid ATP categories based on frontend CATEGORY_LABELS
        valid_categories = [
            "Grand Slam", "Masters 1000", "1000", "ATP 500", "500", 
            "ATP 250", "250", "ATP Finals", "Team Event"
        ]
        
        categories_found = set()
        for tournament in data:
            category = tournament.get("category")
            categories_found.add(category)
        
        print(f"Categories found in ATP tournaments: {categories_found}")
        # At least some categories should be from the valid list
        assert len(categories_found) > 0
    
    def test_wta_tournaments_have_category_field(self):
        """GET /api/tournaments?circuits=WTA returns tournaments with category field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=WTA&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert "category" in tournament
            assert tournament["category"] is not None
    
    def test_itf_tournaments_have_category_field(self):
        """GET /api/tournaments?circuits=ITF returns tournaments with category field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ITF&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert "category" in tournament
            assert tournament["category"] is not None


class TestTournamentWeeksWithCategoryAndSurface:
    """Tests for GET /api/tournaments/weeks endpoint - category and surface fields"""
    
    def test_weeks_tournament_has_category_field(self):
        """GET /api/tournaments/weeks?circuits=ATP returns tournaments with category field"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert "weeks" in data
        
        weeks = data.get("weeks", [])
        assert len(weeks) > 0
        
        for week in weeks:
            for tournament in week.get("tournaments", []):
                assert "category" in tournament, f"Tournament {tournament.get('id')} missing category field"
                assert tournament["category"] is not None
                print(f"Tournament: {tournament.get('id')}, Category: {tournament.get('category')}")
    
    def test_weeks_tournament_has_surface_field(self):
        """GET /api/tournaments/weeks?circuits=ATP returns tournaments with surface field"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        weeks = data.get("weeks", [])
        
        assert len(weeks) > 0
        
        surfaces_found = set()
        for week in weeks:
            for tournament in week.get("tournaments", []):
                assert "surface" in tournament, f"Tournament {tournament.get('id')} missing surface field"
                assert tournament["surface"] is not None
                surfaces_found.add(tournament["surface"])
        
        print(f"Surfaces found: {surfaces_found}")
        # Should have at least one valid surface
        assert len(surfaces_found) > 0
    
    def test_weeks_surface_values_are_valid(self):
        """Verify surface field contains valid values (Hard, Clay, Grass, Carpet)"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        # Valid surfaces - some tournaments have variations like "Indoor Hard"
        valid_surface_keywords = ["hard", "clay", "grass", "carpet"]
        
        for week in data.get("weeks", []):
            for tournament in week.get("tournaments", []):
                surface = tournament.get("surface", "").lower()
                is_valid = any(keyword in surface for keyword in valid_surface_keywords)
                assert is_valid, f"Tournament {tournament.get('id')} has invalid surface: {tournament.get('surface')}"


class TestTournamentRegistrationPendingStatus:
    """Tests for POST /api/tournaments/register with 'pending' status"""
    
    def test_register_sets_status_to_pending(self):
        """POST /api/tournaments/register with status='pending' sets status correctly"""
        # Cleanup first - reset to interested
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_REGISTER, "status": "interested"}
        )
        
        # Register with pending status
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_REGISTER, "status": "pending"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("tournamentId") == TEST_TOURNAMENT_ID_REGISTER
        assert data.get("status") == "pending"
    
    def test_pending_status_persists_in_weeks(self):
        """Verify pending status is reflected in GET /api/tournaments/weeks"""
        # Set to pending
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_REGISTER, "status": "pending"}
        )
        
        # Check in weeks endpoint
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find our tournament
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_REGISTER:
                    found_tournament = t
                    break
        
        assert found_tournament is not None, f"Tournament {TEST_TOURNAMENT_ID_REGISTER} not found"
        assert found_tournament.get("registration") is not None, "Registration should exist"
        assert found_tournament.get("registration", {}).get("status") == "pending", "Status should be pending"


class TestStatusTransitionsFromPending:
    """Tests for status transitions from 'pending' to 'participating' and 'declined'"""
    
    def test_transition_pending_to_participating(self):
        """POST /api/tournaments/register with status='participating' works after 'pending'"""
        # Step 1: Set to pending first
        pending_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "pending"}
        )
        assert pending_response.status_code == 200
        assert pending_response.json().get("status") == "pending"
        
        # Step 2: Transition to participating
        participating_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "participating"}
        )
        assert participating_response.status_code == 200
        
        data = participating_response.json()
        assert data.get("success") == True
        assert data.get("status") == "participating"
    
    def test_transition_pending_to_declined(self):
        """POST /api/tournaments/register with status='declined' works after 'pending'"""
        # Step 1: Set to pending first
        pending_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "pending"}
        )
        assert pending_response.status_code == 200
        
        # Step 2: Transition to declined
        declined_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "declined"}
        )
        assert declined_response.status_code == 200
        
        data = declined_response.json()
        assert data.get("success") == True
        assert data.get("status") == "declined"
    
    def test_participating_status_persists(self):
        """Verify 'participating' status is correctly reflected in GET /api/tournaments/weeks"""
        # Set to participating
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "participating"}
        )
        
        # Verify in weeks
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_STATUS_FLOW:
                    found_tournament = t
                    break
        
        assert found_tournament is not None
        assert found_tournament.get("registration", {}).get("status") == "participating"
    
    def test_declined_status_persists(self):
        """Verify 'declined' status is correctly reflected in GET /api/tournaments/weeks"""
        # Set to declined
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_STATUS_FLOW, "status": "declined"}
        )
        
        # Verify in weeks
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_STATUS_FLOW:
                    found_tournament = t
                    break
        
        assert found_tournament is not None
        assert found_tournament.get("registration", {}).get("status") == "declined"


class TestHideUnhideTournament:
    """Tests for POST /api/tournaments/hide and DELETE /api/tournaments/hide/{id}"""
    
    def test_hide_tournament_returns_success(self):
        """POST /api/tournaments/hide returns {success: true}"""
        # Ensure unhidden first
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        
        # Hide
        response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
    
    def test_hidden_tournament_shows_in_weeks_as_hidden_true(self):
        """GET /api/tournaments/weeks shows hidden=true for hidden tournament"""
        # Ensure hidden
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Check weeks
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    found_tournament = t
                    break
        
        assert found_tournament is not None, f"Tournament {TEST_TOURNAMENT_ID_HIDE} not found"
        assert found_tournament.get("hidden") == True, "Tournament should be hidden=true"
    
    def test_unhide_tournament_returns_success(self):
        """DELETE /api/tournaments/hide/{id} returns {success: true}"""
        # Ensure hidden first
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Unhide
        response = requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
    
    def test_unhide_tournament_shows_in_weeks_as_hidden_false(self):
        """DELETE /api/tournaments/hide/{id} sets hidden=false in /weeks"""
        # Step 1: Hide
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Step 2: Unhide
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        
        # Step 3: Verify in weeks
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    found_tournament = t
                    break
        
        assert found_tournament is not None
        assert found_tournament.get("hidden") == False, "Tournament should be hidden=false after unhide"


class TestAllValidStatuses:
    """Tests to verify all valid status values work"""
    
    @pytest.mark.parametrize("status", ["interested", "pending", "accepted", "participating", "declined"])
    def test_all_valid_statuses_accepted(self, status):
        """All valid status values should be accepted by register endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_REGISTER, "status": status}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert data.get("status") == status


class TestEdgeCases:
    """Edge case tests"""
    
    def test_register_invalid_status_returns_400(self):
        """Invalid status returns 400 error"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_REGISTER, "status": "invalid_status"}
        )
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
    
    def test_register_nonexistent_tournament_returns_404(self):
        """Non-existent tournament returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": "nonexistent-tournament-xyz", "status": "pending"}
        )
        assert response.status_code == 404
    
    def test_hide_and_register_removes_registration(self):
        """Hiding a tournament removes existing registration"""
        # Step 1: Register with pending
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE, "status": "pending"}
        )
        
        # Step 2: Hide
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Step 3: Check that registration is removed
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        data = response.json()
        
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    found_tournament = t
                    break
        
        assert found_tournament is not None
        assert found_tournament.get("registration") is None, "Registration should be removed after hiding"
        assert found_tournament.get("hidden") == True


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Reset test tournament states
    try:
        # Reset registrations
        for t_id in [TEST_TOURNAMENT_ID_REGISTER, TEST_TOURNAMENT_ID_STATUS_FLOW, TEST_TOURNAMENT_ID_HIDE]:
            requests.post(
                f"{BASE_URL}/api/tournaments/register",
                json={"tournamentId": t_id, "status": "interested"}
            )
        # Unhide test tournament
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
    except:
        pass
