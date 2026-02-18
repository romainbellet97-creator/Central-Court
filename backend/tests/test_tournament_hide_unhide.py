"""
Tournament Hide/Unhide and Data Structure Tests
Tests for Phase 1 tournament optimizations:
1. POST /api/tournaments/hide - hides tournament and removes registration
2. DELETE /api/tournaments/hide/{tournament_id} - unhides tournament
3. GET /api/tournaments/weeks - returns weeks with country field for flag mapping
4. GET /api/tournaments - returns tournaments with country, prizeMoney, startDate, endDate
5. Verify hidden tournaments appear with hidden=true in /weeks response
6. Verify tournaments have country names for flag emoji mapping
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://courtside-48.preview.emergentagent.com').rstrip('/')

# Test tournament IDs from the database
TEST_TOURNAMENT_ID_HIDE = "adelaide-2026"  # Used for hide/unhide tests
TEST_TOURNAMENT_ID_WEEKS = "brisbane-2026"  # Another tournament for verification

# Known country mappings from countryFlags.ts
KNOWN_COUNTRY_MAPPINGS = {
    'Australia': 'AU', 'France': 'FR', 'United Kingdom': 'GB', 'UK': 'GB',
    'USA': 'US', 'United States': 'US', 'Austria': 'AT', 'Belgium': 'BE',
    'Croatia': 'HR', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Germany': 'DE',
    'Italy': 'IT', 'Japan': 'JP', 'Monaco': 'MC', 'Netherlands': 'NL',
    'Poland': 'PL', 'Portugal': 'PT', 'Romania': 'RO', 'Slovakia': 'SK',
    'Spain': 'ES', 'Sweden': 'SE', 'Switzerland': 'CH', 'Turkey': 'TR',
    'Argentina': 'AR', 'Brazil': 'BR', 'Canada': 'CA', 'Chile': 'CL',
    'Colombia': 'CO', 'Mexico': 'MX', 'Peru': 'PE', 'China': 'CN',
    'Kazakhstan': 'KZ', 'New Zealand': 'NZ', 'Singapore': 'SG',
    'South Korea': 'KR', 'Korea': 'KR', 'Morocco': 'MA', 'Qatar': 'QA',
    'Saudi Arabia': 'SA', 'United Arab Emirates': 'AE', 'UAE': 'AE',
}


class TestHideTournament:
    """Tests for POST /api/tournaments/hide endpoint"""
    
    def test_hide_tournament_success(self):
        """POST /api/tournaments/hide returns success"""
        # First ensure tournament is not hidden
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        
        response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
    
    def test_hide_tournament_removes_registration(self):
        """Hiding a tournament removes any existing registration"""
        # Step 1: Ensure tournament is unhidden first
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        
        # Step 2: Register for the tournament
        reg_response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE, "status": "interested"}
        )
        assert reg_response.status_code == 200
        
        # Step 3: Verify registration exists
        weeks_response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        weeks_data = weeks_response.json()
        
        tournament_before = None
        for week in weeks_data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    tournament_before = t
                    break
        
        assert tournament_before is not None, f"Tournament {TEST_TOURNAMENT_ID_HIDE} not found"
        assert tournament_before.get("registration") is not None, "Registration should exist before hiding"
        
        # Step 4: Hide the tournament
        hide_response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        assert hide_response.status_code == 200
        
        # Step 5: Verify registration is removed
        weeks_response_after = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        weeks_data_after = weeks_response_after.json()
        
        tournament_after = None
        for week in weeks_data_after.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    tournament_after = t
                    break
        
        assert tournament_after is not None
        assert tournament_after.get("registration") is None, "Registration should be removed after hiding"
        assert tournament_after.get("hidden") == True, "Tournament should be hidden"
    
    def test_hide_tournament_idempotent(self):
        """Hiding same tournament multiple times succeeds"""
        response1 = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        assert response1.status_code == 200
        
        response2 = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        assert response2.status_code == 200
        assert response2.json().get("success") == True
    
    def test_hide_tournament_missing_tournament_id(self):
        """Missing tournamentId returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={}
        )
        assert response.status_code == 422


class TestUnhideTournament:
    """Tests for DELETE /api/tournaments/hide/{tournament_id} endpoint"""
    
    def test_unhide_tournament_success(self):
        """DELETE /api/tournaments/hide/{id} returns success"""
        # First hide the tournament
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Now unhide
        response = requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
    
    def test_unhide_tournament_sets_hidden_false(self):
        """Unhiding tournament sets hidden=false in /weeks response"""
        # Step 1: Hide the tournament
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Verify hidden=true
        weeks_response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        weeks_data = weeks_response.json()
        
        tournament_hidden = None
        for week in weeks_data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    tournament_hidden = t
                    break
        
        assert tournament_hidden is not None
        assert tournament_hidden.get("hidden") == True
        
        # Step 2: Unhide
        unhide_response = requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        assert unhide_response.status_code == 200
        
        # Step 3: Verify hidden=false
        weeks_response_after = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        weeks_data_after = weeks_response_after.json()
        
        tournament_unhidden = None
        for week in weeks_data_after.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    tournament_unhidden = t
                    break
        
        assert tournament_unhidden is not None
        assert tournament_unhidden.get("hidden") == False
    
    def test_unhide_nonexistent_tournament(self):
        """Unhiding non-existent tournament still returns success (idempotent)"""
        response = requests.delete(f"{BASE_URL}/api/tournaments/hide/nonexistent-id-12345")
        # Should succeed even if tournament doesn't exist (delete is idempotent)
        assert response.status_code == 200
        assert response.json().get("success") == True


class TestTournamentWeeksData:
    """Tests for GET /api/tournaments/weeks endpoint data structure"""
    
    def test_weeks_returns_weeks_array(self):
        """GET /api/tournaments/weeks returns weeks array"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert "weeks" in data
        assert isinstance(data["weeks"], list)
        assert len(data["weeks"]) > 0
    
    def test_weeks_returns_total_tournaments_count(self):
        """GET /api/tournaments/weeks returns totalTournaments count"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        assert "totalTournaments" in data
        assert isinstance(data["totalTournaments"], int)
        assert data["totalTournaments"] == 60  # ATP has 60 tournaments
    
    def test_weeks_tournament_has_country_field(self):
        """Tournaments in weeks response have country field for flag mapping"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        weeks = data.get("weeks", [])
        
        assert len(weeks) > 0
        first_week = weeks[0]
        tournaments = first_week.get("tournaments", [])
        
        assert len(tournaments) > 0
        for tournament in tournaments:
            assert "country" in tournament, f"Tournament {tournament.get('id')} missing country field"
            assert tournament["country"] is not None
            assert isinstance(tournament["country"], str)
            assert len(tournament["country"]) > 0
    
    def test_weeks_tournament_has_hidden_field(self):
        """Tournaments in weeks response have hidden field"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        for week in data.get("weeks", []):
            for tournament in week.get("tournaments", []):
                assert "hidden" in tournament, f"Tournament {tournament.get('id')} missing hidden field"
                assert isinstance(tournament["hidden"], bool)
    
    def test_weeks_tournament_has_registration_field(self):
        """Tournaments in weeks response have registration field"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        for week in data.get("weeks", []):
            for tournament in week.get("tournaments", []):
                assert "registration" in tournament, f"Tournament {tournament.get('id')} missing registration field"
                # registration can be null or object
    
    def test_weeks_tournament_has_prize_money(self):
        """Tournaments in weeks response have prizeMoney field"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        for week in data.get("weeks", []):
            for tournament in week.get("tournaments", []):
                assert "prizeMoney" in tournament, f"Tournament {tournament.get('id')} missing prizeMoney field"
                assert isinstance(tournament["prizeMoney"], (int, float))
    
    def test_weeks_tournament_has_date_fields(self):
        """Tournaments in weeks response have startDate and endDate fields"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        for week in data.get("weeks", []):
            for tournament in week.get("tournaments", []):
                assert "startDate" in tournament, f"Tournament {tournament.get('id')} missing startDate"
                assert "endDate" in tournament, f"Tournament {tournament.get('id')} missing endDate"


class TestTournamentListData:
    """Tests for GET /api/tournaments endpoint data structure"""
    
    def test_tournaments_have_country_field(self):
        """GET /api/tournaments returns tournaments with country field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        for tournament in data:
            assert "country" in tournament, f"Tournament {tournament.get('id')} missing country"
            assert tournament["country"] is not None
            assert len(tournament["country"]) > 0
    
    def test_tournaments_have_prize_money_field(self):
        """GET /api/tournaments returns tournaments with prizeMoney field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert "prizeMoney" in tournament, f"Tournament {tournament.get('id')} missing prizeMoney"
            assert isinstance(tournament["prizeMoney"], (int, float))
    
    def test_tournaments_have_date_fields(self):
        """GET /api/tournaments returns tournaments with startDate and endDate"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert "startDate" in tournament
            assert "endDate" in tournament
            # Dates should be ISO format strings
            assert isinstance(tournament["startDate"], str)
            assert isinstance(tournament["endDate"], str)
    
    def test_tournaments_have_currency_field(self):
        """GET /api/tournaments returns tournaments with currency field"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuits=ATP&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        
        for tournament in data:
            assert "currency" in tournament
            assert tournament["currency"] in ["USD", "EUR", "GBP", "AUD", "CHF", "JPY", "CAD", "AED", "QAR", "SAR"]


class TestCountryFlagMapping:
    """Tests to verify country names can be mapped to flag emojis"""
    
    def test_most_countries_are_mappable(self):
        """Most tournament countries should map to known flag codes"""
        response = requests.get(f"{BASE_URL}/api/tournaments?limit=300")
        assert response.status_code == 200
        
        data = response.json()
        countries = set(t.get("country") for t in data if t.get("country"))
        
        mappable_count = 0
        unmappable = []
        
        for country in countries:
            if country in KNOWN_COUNTRY_MAPPINGS:
                mappable_count += 1
            else:
                unmappable.append(country)
        
        # At least 85% of countries should be mappable
        mappable_percent = (mappable_count / len(countries)) * 100
        assert mappable_percent >= 85, f"Only {mappable_percent:.1f}% of countries are mappable. Unmappable: {unmappable}"
        
        print(f"Mappable countries: {mappable_count}/{len(countries)} ({mappable_percent:.1f}%)")
        if unmappable:
            print(f"Unmappable countries: {unmappable}")
    
    def test_common_countries_are_mappable(self):
        """Common tennis countries should all be mappable"""
        common_countries = [
            "Australia", "France", "USA", "United Kingdom",
            "Spain", "Germany", "Italy", "Switzerland",
            "Canada", "China", "Japan"
        ]
        
        for country in common_countries:
            assert country in KNOWN_COUNTRY_MAPPINGS, f"Common country '{country}' should be mappable"


class TestHiddenTournamentsInWeeks:
    """Tests to verify hidden status is correctly reflected in /weeks endpoint"""
    
    def test_hidden_tournament_shows_hidden_true(self):
        """Hidden tournaments appear with hidden=true in /weeks"""
        # Step 1: Hide a tournament
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": TEST_TOURNAMENT_ID_HIDE}
        )
        
        # Step 2: Check /weeks endpoint
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find the tournament
        found = False
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    assert t.get("hidden") == True, "Hidden tournament should have hidden=true"
                    found = True
                    break
        
        assert found, f"Tournament {TEST_TOURNAMENT_ID_HIDE} not found in weeks"
        
        # Cleanup: unhide
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
    
    def test_unhidden_tournament_shows_hidden_false(self):
        """Unhidden tournaments appear with hidden=false in /weeks"""
        # Step 1: Ensure tournament is unhidden
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        
        # Step 2: Check /weeks endpoint
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=ATP")
        assert response.status_code == 200
        
        data = response.json()
        
        # Find the tournament
        found = False
        for week in data.get("weeks", []):
            for t in week.get("tournaments", []):
                if t.get("id") == TEST_TOURNAMENT_ID_HIDE:
                    assert t.get("hidden") == False, "Unhidden tournament should have hidden=false"
                    found = True
                    break
        
        assert found


# Cleanup fixture
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Reset test tournament state
    try:
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_HIDE}")
        requests.delete(f"{BASE_URL}/api/tournaments/hide/{TEST_TOURNAMENT_ID_WEEKS}")
    except:
        pass
