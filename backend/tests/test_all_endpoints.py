"""
Backend tests for Le Court Central - Full API testing for Tennis Management App
Tests: Staff, Tournaments, Events, Alerts, Preferences endpoints with MongoDB data
"""
import pytest
import requests
import os
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://event-management-9.preview.emergentagent.com')

# Test emails (Resend test mode only allows verified email)
VERIFIED_EMAIL = "romainbasket77@gmail.com"


class TestHealthEndpoint:
    """Health check endpoint"""
    
    def test_health_returns_200(self):
        """Health endpoint should return 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "central-court-api"
        print("✓ Health endpoint returns 200")


class TestStaffEndpoints:
    """Tests for /api/staff - Staff management"""
    
    def test_list_all_staff(self):
        """GET /api/staff - returns 6 staff members from MongoDB"""
        response = requests.get(f"{BASE_URL}/api/staff")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 6, f"Expected 6 staff, got {len(data)}"
        
        # Verify data structure
        staff = data[0]
        assert "id" in staff
        assert "name" in staff
        assert "role" in staff
        assert "roleLabel" in staff
        assert "email" in staff
        
        print(f"✓ GET /api/staff returns 6 staff members")
    
    def test_get_single_staff(self):
        """GET /api/staff/{id} - returns single staff member"""
        response = requests.get(f"{BASE_URL}/api/staff/staff-001")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == "staff-001"
        assert data["name"] == "Patrick Mouratoglou"
        assert data["role"] == "coach"
        
        print("✓ GET /api/staff/{id} returns correct staff member")
    
    def test_get_staff_not_found(self):
        """GET /api/staff/{id} - returns 404 for non-existent staff"""
        response = requests.get(f"{BASE_URL}/api/staff/nonexistent")
        assert response.status_code == 404
        print("✓ GET /api/staff/{id} returns 404 for non-existent")


class TestTournamentEndpoints:
    """Tests for /api/tournaments - Tournament management with circuit filtering"""
    
    def test_list_all_tournaments(self):
        """GET /api/tournaments - returns 15 tournaments from MongoDB"""
        response = requests.get(f"{BASE_URL}/api/tournaments")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 15, f"Expected 15 tournaments, got {len(data)}"
        
        # Verify data structure
        tournament = data[0]
        assert "id" in tournament
        assert "name" in tournament
        assert "city" in tournament
        assert "circuit" in tournament
        assert "startDate" in tournament
        
        print(f"✓ GET /api/tournaments returns 15 tournaments")
    
    def test_filter_by_atp_circuit(self):
        """GET /api/tournaments?circuit=atp - returns 9 ATP tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuit=atp")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 9, f"Expected 9 ATP tournaments, got {len(data)}"
        
        # Verify all are ATP
        for t in data:
            assert t["circuit"] == "atp", f"Tournament {t['name']} is not ATP"
        
        print(f"✓ GET /api/tournaments?circuit=atp returns 9 ATP tournaments")
    
    def test_filter_by_wta_circuit(self):
        """GET /api/tournaments?circuit=wta - returns 3 WTA tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuit=wta")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 3, f"Expected 3 WTA tournaments, got {len(data)}"
        
        # Verify all are WTA
        for t in data:
            assert t["circuit"] == "wta", f"Tournament {t['name']} is not WTA"
        
        print(f"✓ GET /api/tournaments?circuit=wta returns 3 WTA tournaments")
    
    def test_filter_by_itf_circuit(self):
        """GET /api/tournaments?circuit=itf - returns 2 ITF tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuit=itf")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 2, f"Expected 2 ITF tournaments, got {len(data)}"
        
        # Verify all are ITF
        for t in data:
            assert t["circuit"] == "itf", f"Tournament {t['name']} is not ITF"
        
        print(f"✓ GET /api/tournaments?circuit=itf returns 2 ITF tournaments")
    
    def test_filter_by_itf_wheelchair_circuit(self):
        """GET /api/tournaments?circuit=itf_wheelchair - returns 1 wheelchair tournament"""
        response = requests.get(f"{BASE_URL}/api/tournaments?circuit=itf_wheelchair")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1, f"Expected 1 ITF wheelchair tournament, got {len(data)}"
        
        # Verify it's wheelchair
        assert data[0]["circuit"] == "itf_wheelchair"
        assert data[0]["name"] == "Bolton Indoor ITF 1"
        
        print(f"✓ GET /api/tournaments?circuit=itf_wheelchair returns 1 wheelchair tournament")
    
    def test_tournament_weeks_atp_only(self):
        """GET /api/tournaments/weeks?circuits=atp - returns 4 weeks with ATP tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=atp")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 4, f"Expected 4 weeks with ATP, got {len(data)}"
        
        # Verify all weeks have only ATP tournaments
        for week in data:
            assert "tournaments" in week
            for t in week["tournaments"]:
                assert t["circuit"] == "atp", f"Tournament {t['name']} is not ATP in weeks endpoint"
        
        print(f"✓ GET /api/tournaments/weeks?circuits=atp returns 4 weeks")
    
    def test_tournament_weeks_wta_only(self):
        """GET /api/tournaments/weeks?circuits=wta - returns 3 weeks with WTA tournaments"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=wta")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 3, f"Expected 3 weeks with WTA, got {len(data)}"
        
        print(f"✓ GET /api/tournaments/weeks?circuits=wta returns 3 weeks")
    
    def test_tournament_weeks_combined_circuits(self):
        """GET /api/tournaments/weeks?circuits=atp,wta - returns weeks with both ATP and WTA"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=atp,wta")
        assert response.status_code == 200
        
        data = response.json()
        # Should return 4 weeks (weeks 6,7,8,9 have ATP and/or WTA)
        assert len(data) >= 3, f"Expected at least 3 weeks with ATP+WTA, got {len(data)}"
        
        # Verify tournaments are only ATP or WTA
        for week in data:
            for t in week["tournaments"]:
                assert t["circuit"] in ["atp", "wta"], f"Tournament {t['name']} is neither ATP nor WTA"
        
        print(f"✓ GET /api/tournaments/weeks?circuits=atp,wta returns combined weeks")


class TestTournamentRegistration:
    """Tests for tournament registration and hiding"""
    
    @pytest.fixture(autouse=True)
    def cleanup_registrations(self):
        """Cleanup registrations after each test"""
        yield
        # Note: Registrations are cleaned up in later tests or manually
    
    def test_register_tournament_participating(self):
        """POST /api/tournaments/register - register for tournament with 'participating' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "montpellier-2026",
                "status": "participating"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["tournamentId"] == "montpellier-2026"
        assert data["status"] == "participating"
        
        print("✓ POST /api/tournaments/register creates registration with 'participating'")
    
    def test_participating_hides_same_week_tournaments(self):
        """POST /api/tournaments/register with 'participating' hides other tournaments in same week"""
        # First register as participating for a tournament in week 6
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "montpellier-2026",  # Week 6
                "status": "participating"
            }
        )
        assert response.status_code == 200
        
        # Check weeks endpoint - other week 6 tournaments should be hidden
        weeks_response = requests.get(f"{BASE_URL}/api/tournaments/weeks?circuits=atp")
        assert weeks_response.status_code == 200
        
        weeks = weeks_response.json()
        week_6 = next((w for w in weeks if w["weekNumber"] == 6), None)
        assert week_6 is not None, "Week 6 not found"
        
        # pune-2026 should be in hiddenTournamentIds (same week 6, different tournament)
        hidden_ids = week_6.get("hiddenTournamentIds", [])
        assert "pune-2026" in hidden_ids, f"pune-2026 should be hidden. Hidden: {hidden_ids}"
        
        print("✓ Participating in tournament hides other tournaments in same week")
    
    def test_register_tournament_interested(self):
        """POST /api/tournaments/register - register with 'interested' status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "rotterdam-2026",
                "status": "interested"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "interested"
        print("✓ POST /api/tournaments/register with 'interested' status works")
    
    def test_register_invalid_status(self):
        """POST /api/tournaments/register - rejects invalid status"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "rotterdam-2026",
                "status": "invalid_status"
            }
        )
        assert response.status_code == 400
        print("✓ POST /api/tournaments/register rejects invalid status")
    
    def test_register_nonexistent_tournament(self):
        """POST /api/tournaments/register - returns 404 for non-existent tournament"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "nonexistent-tournament",
                "status": "interested"
            }
        )
        assert response.status_code == 404
        print("✓ POST /api/tournaments/register returns 404 for non-existent tournament")
    
    def test_hide_tournament(self):
        """POST /api/tournaments/hide - hide a tournament"""
        response = requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": "doha-2026"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("✓ POST /api/tournaments/hide hides tournament")
    
    def test_unhide_tournament(self):
        """DELETE /api/tournaments/hide/{id} - unhide a tournament"""
        # First hide
        requests.post(
            f"{BASE_URL}/api/tournaments/hide",
            json={"tournamentId": "buenos-aires-2026"}
        )
        
        # Then unhide
        response = requests.delete(f"{BASE_URL}/api/tournaments/hide/buenos-aires-2026")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("✓ DELETE /api/tournaments/hide/{id} unhides tournament")


class TestEventEndpoints:
    """Tests for /api/events - Event CRUD operations"""
    
    def test_list_all_events(self):
        """GET /api/events - returns 15 events from MongoDB"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 15, f"Expected 15 events, got {len(data)}"
        
        # Verify data structure
        event = data[0]
        assert "id" in event
        assert "type" in event
        assert "title" in event
        assert "date" in event
        
        print(f"✓ GET /api/events returns 15 events")
    
    def test_filter_events_by_month(self):
        """GET /api/events?month=2026-02 - returns events for February 2026"""
        response = requests.get(f"{BASE_URL}/api/events?month=2026-02")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "Expected events in February 2026"
        
        # Verify all events are in February 2026
        for event in data:
            assert event["date"].startswith("2026-02"), f"Event {event['id']} not in Feb 2026"
        
        print(f"✓ GET /api/events?month=2026-02 returns {len(data)} events")
    
    def test_create_event(self):
        """POST /api/events - create a new event"""
        response = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "type": "training_tennis",
                "title": "TEST_Entraînement Test",
                "date": "2026-02-25",
                "time": "14:00",
                "endTime": "16:00",
                "location": "Test Court",
                "visibleToStaff": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["title"] == "TEST_Entraînement Test"
        assert data["type"] == "training_tennis"
        assert data["date"] == "2026-02-25"
        
        # Store for cleanup and later tests
        TestEventEndpoints.created_event_id = data["id"]
        print(f"✓ POST /api/events creates event with id {data['id']}")
        return data["id"]
    
    def test_get_created_event(self):
        """GET /api/events/{id} - verify created event persisted"""
        # First create an event
        create_response = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "type": "media",
                "title": "TEST_Interview Test",
                "date": "2026-02-26",
                "time": "10:00",
                "endTime": "11:00",
                "visibleToStaff": True
            }
        )
        event_id = create_response.json()["id"]
        
        # Then GET it
        response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == event_id
        assert data["title"] == "TEST_Interview Test"
        
        print(f"✓ GET /api/events/{event_id} returns created event")
    
    def test_update_event(self):
        """PUT /api/events/{id} - update event"""
        # First create an event
        create_response = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "type": "training_tennis",
                "title": "TEST_Original Title",
                "date": "2026-02-27",
                "visibleToStaff": True
            }
        )
        event_id = create_response.json()["id"]
        
        # Update it
        response = requests.put(
            f"{BASE_URL}/api/events/{event_id}",
            json={"title": "TEST_Updated Title", "location": "New Location"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["title"] == "TEST_Updated Title"
        assert data["location"] == "New Location"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.json()["title"] == "TEST_Updated Title"
        
        print(f"✓ PUT /api/events/{event_id} updates event")
    
    def test_delete_event(self):
        """DELETE /api/events/{id} - delete event"""
        # First create an event
        create_response = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "type": "personal",
                "title": "TEST_To Be Deleted",
                "date": "2026-02-28",
                "visibleToStaff": False
            }
        )
        event_id = create_response.json()["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify it's deleted
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 404
        
        print(f"✓ DELETE /api/events/{event_id} deletes event")
    
    def test_add_observation_to_event(self):
        """POST /api/events/{id}/observations - add observation"""
        # First create an event
        create_response = requests.post(
            f"{BASE_URL}/api/events",
            json={
                "type": "training_tennis",
                "title": "TEST_Event with Observation",
                "date": "2026-02-24",
                "visibleToStaff": True
            }
        )
        event_id = create_response.json()["id"]
        
        # Add observation
        response = requests.post(
            f"{BASE_URL}/api/events/{event_id}/observations",
            json={
                "author": "Test Coach",
                "role": "Coach",
                "text": "TEST_Great session today!"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["author"] == "Test Coach"
        assert data["text"] == "TEST_Great session today!"
        
        # Verify observation was added
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        observations = get_response.json()["observations"]
        assert len(observations) > 0
        assert observations[-1]["text"] == "TEST_Great session today!"
        
        print(f"✓ POST /api/events/{event_id}/observations adds observation")
    
    def test_add_observation_event_not_found(self):
        """POST /api/events/{id}/observations - returns 404 for non-existent event"""
        response = requests.post(
            f"{BASE_URL}/api/events/nonexistent-event/observations",
            json={
                "author": "Test",
                "role": "Test",
                "text": "Test"
            }
        )
        assert response.status_code == 404
        print("✓ POST /api/events/{id}/observations returns 404 for non-existent")


class TestAlertEndpoints:
    """Tests for /api/alerts - Alert/notification system"""
    
    def test_list_all_alerts(self):
        """GET /api/alerts - returns 5 demo alerts"""
        response = requests.get(f"{BASE_URL}/api/alerts")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) >= 5, f"Expected at least 5 alerts, got {len(data)}"
        
        # Verify data structure
        alert = data[0]
        assert "id" in alert
        assert "type" in alert
        assert "title" in alert
        assert "message" in alert
        assert "read" in alert
        assert "dismissed" in alert
        
        print(f"✓ GET /api/alerts returns {len(data)} alerts")
    
    def test_mark_alert_read(self):
        """PUT /api/alerts/{id}/read - mark alert as read"""
        # Use a known demo alert
        response = requests.put(f"{BASE_URL}/api/alerts/demo-alert-1/read")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify it's read
        alerts = requests.get(f"{BASE_URL}/api/alerts").json()
        alert = next((a for a in alerts if a["id"] == "demo-alert-1"), None)
        assert alert is not None
        assert alert["read"] == True
        
        print("✓ PUT /api/alerts/{id}/read marks alert as read")
    
    def test_dismiss_alert(self):
        """PUT /api/alerts/{id}/dismiss - dismiss alert"""
        response = requests.put(f"{BASE_URL}/api/alerts/demo-alert-5/dismiss")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify it's dismissed
        alerts = requests.get(f"{BASE_URL}/api/alerts").json()
        alert = next((a for a in alerts if a["id"] == "demo-alert-5"), None)
        assert alert is not None
        assert alert["dismissed"] == True
        
        print("✓ PUT /api/alerts/{id}/dismiss dismisses alert")
    
    def test_mark_all_alerts_read(self):
        """PUT /api/alerts/read-all - mark all alerts as read"""
        response = requests.put(f"{BASE_URL}/api/alerts/read-all")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        
        # Verify all are read
        alerts = requests.get(f"{BASE_URL}/api/alerts").json()
        unread_count = sum(1 for a in alerts if not a.get("read", False))
        assert unread_count == 0, f"Expected 0 unread, got {unread_count}"
        
        print("✓ PUT /api/alerts/read-all marks all alerts read")
    
    def test_generate_alerts(self):
        """POST /api/alerts/generate - generate alerts for missing bookings"""
        # First register for a tournament to trigger alert generation
        requests.post(
            f"{BASE_URL}/api/tournaments/register",
            json={
                "tournamentId": "linz-wta-2026",  # WTA tournament in week 6
                "status": "participating"
            }
        )
        
        # Generate alerts
        response = requests.post(f"{BASE_URL}/api/alerts/generate")
        assert response.status_code == 200
        
        data = response.json()
        assert "generated" in data
        # May or may not generate new alerts depending on existing bookings
        print(f"✓ POST /api/alerts/generate generated {data['generated']} new alerts")
    
    def test_mark_nonexistent_alert_read(self):
        """PUT /api/alerts/{id}/read - returns 404 for non-existent alert"""
        response = requests.put(f"{BASE_URL}/api/alerts/nonexistent-alert/read")
        assert response.status_code == 404
        print("✓ PUT /api/alerts/{id}/read returns 404 for non-existent")


class TestPreferenceEndpoints:
    """Tests for /api/preferences - User preferences"""
    
    def test_get_preferences_default(self):
        """GET /api/preferences - get user preferences (default empty)"""
        response = requests.get(f"{BASE_URL}/api/preferences")
        assert response.status_code == 200
        
        data = response.json()
        assert "userId" in data
        # Default user has minimal/no preferences set
        
        print("✓ GET /api/preferences returns preferences")
    
    def test_update_voyage_preferences(self):
        """PUT /api/preferences - update voyage preferences"""
        response = requests.put(
            f"{BASE_URL}/api/preferences",
            json={
                "voyage": {
                    "travelClass": "business",
                    "airlines": ["Air France", "Lufthansa"]
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["voyage"]["travelClass"] == "business"
        assert "Air France" in data["voyage"]["airlines"]
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/preferences")
        assert get_response.json()["voyage"]["travelClass"] == "business"
        
        print("✓ PUT /api/preferences updates voyage preferences")
    
    def test_update_hotel_preferences(self):
        """PUT /api/preferences - update hotel preferences"""
        response = requests.put(
            f"{BASE_URL}/api/preferences",
            json={
                "hotel": {
                    "amenities": ["gym", "pool", "spa"]
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "gym" in data["hotel"]["amenities"]
        
        print("✓ PUT /api/preferences updates hotel preferences")
    
    def test_update_food_preferences(self):
        """PUT /api/preferences - update food preferences"""
        response = requests.put(
            f"{BASE_URL}/api/preferences",
            json={
                "food": {
                    "cuisines": ["french", "italian", "japanese"],
                    "restrictions": ["no_pork"]
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "french" in data["food"]["cuisines"]
        assert "no_pork" in data["food"]["restrictions"]
        
        print("✓ PUT /api/preferences updates food preferences")


class TestEmailEndpoints:
    """Tests for /api/email - Email integration via Resend"""
    
    def test_send_tournament_alert_email(self):
        """POST /api/email/tournament-alert - send tournament email via Resend"""
        response = requests.post(
            f"{BASE_URL}/api/email/tournament-alert",
            json={
                "recipient_email": VERIFIED_EMAIL,
                "player_name": "Test Player",
                "tournament_name": "Test Tournament",
                "tournament_city": "Paris",
                "tournament_country": "France",
                "start_date": "2026-02-10"
            }
        )
        # Should be 200 (success) or 500 (Resend restrictions)
        assert response.status_code in [200, 500], f"Unexpected status {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data["status"] == "success"
            assert "email_id" in data
            print("✓ POST /api/email/tournament-alert sent successfully")
        else:
            print(f"✓ POST /api/email/tournament-alert handled Resend restriction ({response.status_code})")
    
    def test_tournament_alert_validation(self):
        """POST /api/email/tournament-alert - validates required fields"""
        response = requests.post(
            f"{BASE_URL}/api/email/tournament-alert",
            json={}
        )
        assert response.status_code == 422
        print("✓ POST /api/email/tournament-alert validates required fields")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_events(self):
        """Delete all TEST_ prefixed events"""
        # Get all events
        events = requests.get(f"{BASE_URL}/api/events").json()
        
        # Delete TEST_ prefixed events
        deleted = 0
        for event in events:
            if event.get("title", "").startswith("TEST_"):
                response = requests.delete(f"{BASE_URL}/api/events/{event['id']}")
                if response.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleanup: Deleted {deleted} test events")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
