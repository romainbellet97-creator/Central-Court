"""
Tournament Conflict Detection Tests - Phase 3
Tests for GET /api/tournaments/conflicts/{tournament_id} endpoint:
1. Returns conflict data with tournament, calendarEvents, conflictingTournaments, totalConflicts
2. Detects overlapping tournaments that are registered (pending/participating/interested)
3. Returns 404 for non-existent tournaments
4. Validates registration flow still works correctly

Key Test Data:
- dallas-2026 and rotterdam-2026 are in week 6 (same dates: 2026-02-09 to 2026-02-15)
- They should conflict if one is registered with pending/participating/interested status
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com').rstrip('/')

# Test tournament IDs in the same week (week 6)
TOURNAMENT_DALLAS = "dallas-2026"
TOURNAMENT_ROTTERDAM = "rotterdam-2026"

# Test tournament for non-conflict scenarios
TOURNAMENT_OTHER = "australian-open-2026"


class TestConflictsEndpointBasic:
    """Basic tests for GET /api/tournaments/conflicts/{tournament_id}"""
    
    def test_conflicts_endpoint_returns_200_for_valid_tournament(self):
        """GET /api/tournaments/conflicts/{id} returns 200 for valid tournament"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
    
    def test_conflicts_endpoint_returns_404_for_nonexistent(self):
        """GET /api/tournaments/conflicts/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/nonexistent-tournament-xyz")
        assert response.status_code == 404
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
    
    def test_conflicts_response_has_required_fields(self):
        """Response contains tournament, calendarEvents, conflictingTournaments, totalConflicts"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all required fields exist
        assert "tournament" in data, "Response missing 'tournament' field"
        assert "calendarEvents" in data, "Response missing 'calendarEvents' field"
        assert "conflictingTournaments" in data, "Response missing 'conflictingTournaments' field"
        assert "totalConflicts" in data, "Response missing 'totalConflicts' field"
    
    def test_tournament_field_structure(self):
        """tournament field has id, name, startDate, endDate"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        tournament = data.get("tournament", {})
        
        assert "id" in tournament, "tournament.id missing"
        assert "name" in tournament, "tournament.name missing"
        assert "startDate" in tournament, "tournament.startDate missing"
        assert "endDate" in tournament, "tournament.endDate missing"
        
        assert tournament["id"] == TOURNAMENT_DALLAS
        assert tournament["name"] == "Dallas Open"
    
    def test_calendar_events_is_array(self):
        """calendarEvents field is an array"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("calendarEvents"), list), "calendarEvents should be an array"
    
    def test_conflicting_tournaments_is_array(self):
        """conflictingTournaments field is an array"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("conflictingTournaments"), list), "conflictingTournaments should be an array"
    
    def test_total_conflicts_is_integer(self):
        """totalConflicts field is an integer"""
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data.get("totalConflicts"), int), "totalConflicts should be an integer"


class TestConflictsDetection:
    """Tests for conflict detection logic between tournaments"""
    
    def test_detects_conflict_with_pending_tournament(self):
        """Conflicts detected when overlapping tournament has 'pending' status"""
        # Step 1: Register rotterdam with 'pending' status
        reg_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "pending"}
        )
        assert reg_response.status_code == 200
        
        # Step 2: Check conflicts for dallas (same week as rotterdam)
        conflicts_response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert conflicts_response.status_code == 200
        
        data = conflicts_response.json()
        
        # Should detect rotterdam as a conflict
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        assert TOURNAMENT_ROTTERDAM in conflict_ids, f"Rotterdam should be in conflicts. Found: {conflict_ids}"
        
        # Verify conflict has correct structure
        rotterdam_conflict = next((c for c in conflicting if c.get("id") == TOURNAMENT_ROTTERDAM), None)
        assert rotterdam_conflict is not None
        assert rotterdam_conflict.get("status") == "pending"
        assert rotterdam_conflict.get("type") == "tournament"
        assert rotterdam_conflict.get("name") == "ABN AMRO Open"
    
    def test_detects_conflict_with_participating_tournament(self):
        """Conflicts detected when overlapping tournament has 'participating' status"""
        # Register rotterdam with 'participating' status
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "participating"}
        )
        
        # Check conflicts for dallas
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        assert TOURNAMENT_ROTTERDAM in conflict_ids
        
        # Verify status is participating
        rotterdam_conflict = next((c for c in conflicting if c.get("id") == TOURNAMENT_ROTTERDAM), None)
        assert rotterdam_conflict.get("status") == "participating"
    
    def test_detects_conflict_with_interested_tournament(self):
        """Conflicts detected when overlapping tournament has 'interested' status"""
        # Register rotterdam with 'interested' status
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "interested"}
        )
        
        # Check conflicts for dallas
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        assert TOURNAMENT_ROTTERDAM in conflict_ids
    
    def test_no_conflict_with_declined_tournament(self):
        """No conflict detected when overlapping tournament has 'declined' status"""
        # First cleanup - remove rotterdam registration
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TOURNAMENT_ROTTERDAM}")
        
        # Register rotterdam with 'declined' status
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "declined"}
        )
        
        # Check conflicts for dallas
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        # Declined tournaments should NOT show as conflicts
        assert TOURNAMENT_ROTTERDAM not in conflict_ids, "Declined tournament should not be a conflict"
    
    def test_no_conflict_when_tournament_hidden(self):
        """No conflict detected when overlapping tournament is hidden (no registration)"""
        # Hide rotterdam (this removes registration)
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TOURNAMENT_ROTTERDAM}
        )
        
        # Check conflicts for dallas
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        # Hidden tournament should NOT show as conflict (no registration)
        assert TOURNAMENT_ROTTERDAM not in conflict_ids
        
        # Cleanup - unhide
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TOURNAMENT_ROTTERDAM}")


class TestConflictTotalCount:
    """Tests for totalConflicts field accuracy"""
    
    def test_total_conflicts_matches_array_lengths(self):
        """totalConflicts equals sum of calendarEvents and conflictingTournaments lengths"""
        # Register rotterdam to create a conflict
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "pending"}
        )
        
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        
        expected_total = len(data.get("calendarEvents", [])) + len(data.get("conflictingTournaments", []))
        actual_total = data.get("totalConflicts", 0)
        
        assert actual_total == expected_total, f"totalConflicts ({actual_total}) != calendarEvents + conflictingTournaments ({expected_total})"
    
    def test_zero_conflicts_when_no_registered_overlapping(self):
        """totalConflicts is 0 when no registered overlapping tournaments"""
        # Make sure rotterdam is not registered (hide it)
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TOURNAMENT_ROTTERDAM}
        )
        
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Should have no tournament conflicts (might still have calendar events)
        assert len(data.get("conflictingTournaments", [])) == 0
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TOURNAMENT_ROTTERDAM}")


class TestConflictingTournamentStructure:
    """Tests for conflictingTournaments item structure"""
    
    def test_conflicting_tournament_has_required_fields(self):
        """Each conflicting tournament has id, name, startDate, endDate, status, type"""
        # Register rotterdam to create a conflict
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "pending"}
        )
        
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        
        assert len(conflicting) > 0, "Expected at least one conflicting tournament"
        
        conflict = conflicting[0]
        required_fields = ["id", "name", "startDate", "endDate", "status", "type"]
        
        for field in required_fields:
            assert field in conflict, f"Conflicting tournament missing field: {field}"
    
    def test_conflicting_tournament_type_is_tournament(self):
        """type field is 'tournament' for conflicting tournaments"""
        # Register rotterdam to create a conflict
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_ROTTERDAM, "status": "pending"}
        )
        
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        
        for conflict in data.get("conflictingTournaments", []):
            assert conflict.get("type") == "tournament"


class TestRegistrationFlowIntegration:
    """Tests verifying registration flow still works with conflict detection"""
    
    def test_register_with_different_statuses(self):
        """POST /api/tournaments/register works with all valid statuses"""
        valid_statuses = ["interested", "pending", "participating", "declined"]
        
        for status in valid_statuses:
            response = requests.post(
                f"{BASE_URL}/api/tournaments/register",
                json={"tournamentId": TOURNAMENT_DALLAS, "status": status}
            )
            assert response.status_code == 200, f"Failed for status: {status}"
            
            data = response.json()
            assert data.get("success") == True
            assert data.get("status") == status
    
    def test_registration_status_persists_in_weeks(self):
        """Registration status is reflected in GET /api/tournaments/weeks"""
        # Register with pending
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_DALLAS, "status": "pending"}
        )
        
        # Check in weeks
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find dallas tournament
        found_tournament = None
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TOURNAMENT_DALLAS:
                    found_tournament = t
                    break
        
        assert found_tournament is not None
        assert found_tournament.get("registration") is not None
        assert found_tournament.get("registration", {}).get("status") == "pending"


class TestReverseConflictCheck:
    """Test conflicts from the other tournament's perspective"""
    
    def test_conflict_is_bidirectional(self):
        """If dallas conflicts with rotterdam, rotterdam should also conflict with dallas"""
        # Register dallas with pending
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_DALLAS, "status": "pending"}
        )
        
        # Check conflicts for rotterdam
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_ROTTERDAM}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        assert TOURNAMENT_DALLAS in conflict_ids, f"Dallas should be a conflict for Rotterdam. Found: {conflict_ids}"


class TestNonOverlappingTournaments:
    """Tests for tournaments that don't overlap"""
    
    def test_no_conflicts_for_different_weeks(self):
        """Tournaments in different weeks don't conflict"""
        # Australian Open is week 3-4, not same as Dallas (week 6)
        # Register Australian Open
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TOURNAMENT_OTHER, "status": "pending"}
        )
        
        # Check conflicts for dallas
        response = requests.get(f"{BASE_URL}/api/tournaments/conflicts/{TOURNAMENT_DALLAS}")
        assert response.status_code == 200
        
        data = response.json()
        conflicting = data.get("conflictingTournaments", [])
        conflict_ids = [c.get("id") for c in conflicting]
        
        # Australian Open should NOT be a conflict (different week)
        assert TOURNAMENT_OTHER not in conflict_ids


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Reset test tournament states
    try:
        # Reset registrations
        for t_id in [TOURNAMENT_DALLAS, TOURNAMENT_ROTTERDAM, TOURNAMENT_OTHER]:
            requests.post(
                f"{BASE_URL}/api/tournaments/register",
                json={"tournamentId": t_id, "status": "interested"}
            )
            requests.delete(f"{BASE_URL}/api/tournaments/hide/{t_id}")
    except:
        pass
