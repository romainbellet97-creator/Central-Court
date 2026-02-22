"""
Sprint Technique - Backend API Tests
=====================================
Tests for:
- FEATURE #3: Events with endTime field and duration calculation
- API Events: GET /api/events returns events with endTime
"""

import pytest
import requests
import os
import uuid

# Use environment variable for BASE_URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEventEndTimeFeature:
    """FEATURE #3: Test that events have endTime field"""
    
    def test_list_events_month_has_endtime(self):
        """API Events: GET /api/events?month=2026-02 retourne des événements avec endTime"""
        response = requests.get(f"{BASE_URL}/api/events?month=2026-02")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        events = response.json()
        assert isinstance(events, list), "Response should be a list"
        assert len(events) > 0, "Should have at least one event for February 2026"
        
        # Find events that have endTime defined
        events_with_endtime = [e for e in events if e.get('endTime')]
        
        assert len(events_with_endtime) > 0, "At least one event should have endTime field"
        
        # Verify endTime format (HH:MM)
        for event in events_with_endtime[:5]:  # Check first 5
            end_time = event['endTime']
            parts = end_time.split(':')
            assert len(parts) == 2, f"endTime should be HH:MM format, got: {end_time}"
            assert parts[0].isdigit() and parts[1].isdigit(), f"Invalid time format: {end_time}"
        
        print(f"PASS: Found {len(events_with_endtime)} events with endTime out of {len(events)} total")
    
    def test_event_time_range_display_data(self):
        """FEATURE #3: Verify events have both time and endTime for range display"""
        response = requests.get(f"{BASE_URL}/api/events?month=2026-02")
        
        assert response.status_code == 200
        events = response.json()
        
        # Find events with complete time range (time AND endTime)
        events_with_range = [e for e in events if e.get('time') and e.get('endTime')]
        
        assert len(events_with_range) > 0, "At least one event should have both time and endTime"
        
        # Verify time range logic
        for event in events_with_range[:3]:
            time = event['time']
            end_time = event['endTime']
            
            print(f"Event '{event.get('title')}': {time} → {end_time}")
            
            # Both should be valid times
            assert len(time.split(':')) == 2, f"Invalid time format: {time}"
            assert len(end_time.split(':')) == 2, f"Invalid endTime format: {end_time}"
        
        print(f"PASS: {len(events_with_range)} events have complete time range")
    
    def test_create_event_with_endtime(self):
        """Test creating an event with endTime field"""
        test_id = f"TEST_{uuid.uuid4().hex[:8]}"
        
        event_data = {
            "type": "training",
            "title": f"{test_id} Training Session",
            "date": "2026-02-25",
            "time": "09:00",
            "endTime": "10:30",
            "location": "Test Court",
            "description": "Test event with endTime"
        }
        
        # Create event
        response = requests.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        created_event = response.json()
        event_id = created_event['id']
        
        try:
            # Verify endTime was saved
            assert created_event.get('endTime') == "10:30", f"endTime should be '10:30', got '{created_event.get('endTime')}'"
            assert created_event.get('time') == "09:00", f"time should be '09:00', got '{created_event.get('time')}'"
            
            # Verify via GET
            get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
            assert get_response.status_code == 200
            
            fetched_event = get_response.json()
            assert fetched_event.get('endTime') == "10:30", "endTime should persist in database"
            
            print(f"PASS: Created event with time range 09:00 → 10:30")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}")
    
    def test_update_event_endtime(self):
        """Test updating event endTime field"""
        test_id = f"TEST_{uuid.uuid4().hex[:8]}"
        
        # Create event first
        event_data = {
            "type": "training",
            "title": f"{test_id} Update Test",
            "date": "2026-02-26",
            "time": "14:00",
            "endTime": "15:00"
        }
        
        response = requests.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        event_id = response.json()['id']
        
        try:
            # Update endTime
            update_data = {"endTime": "16:30"}
            update_response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_data)
            assert update_response.status_code == 200
            
            updated_event = update_response.json()
            assert updated_event.get('endTime') == "16:30", f"endTime should be '16:30', got '{updated_event.get('endTime')}'"
            
            print(f"PASS: Updated endTime from 15:00 to 16:30")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/events/{event_id}")


class TestTournamentRegistration:
    """BUG #2: Test tournament status change does not cause issues"""
    
    def test_get_tournaments(self):
        """Verify tournaments endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks")
        
        # Accept both 200 and response with weeks
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        if 'weeks' in data:
            weeks = data['weeks']
        else:
            weeks = data if isinstance(data, list) else []
        
        print(f"PASS: Tournament weeks endpoint accessible, got {len(weeks)} weeks")
    
    def test_tournament_registration_status_update(self):
        """BUG #2: Test changing tournament status (Intéressé → Participant)"""
        # Get tournament weeks first
        response = requests.get(f"{BASE_URL}/api/tournaments/weeks")
        assert response.status_code == 200
        
        data = response.json()
        weeks = data.get('weeks', []) if isinstance(data, dict) else data
        
        if not weeks:
            pytest.skip("No tournament weeks available for testing")
        
        # Find a tournament to test
        tournament_id = None
        for week in weeks:
            tournaments = week.get('tournaments', [])
            for t in tournaments:
                if not t.get('hidden'):
                    tournament_id = t.get('id')
                    break
            if tournament_id:
                break
        
        if not tournament_id:
            pytest.skip("No available tournament found for testing")
        
        # Register as 'interested' first
        response = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/register", json={"status": "interested"})
        # Accept 200, 201 or similar success
        assert response.status_code in [200, 201], f"Registration failed: {response.status_code}"
        
        # Change to 'participating'
        response = requests.post(f"{BASE_URL}/api/tournaments/{tournament_id}/register", json={"status": "participating"})
        assert response.status_code in [200, 201], f"Status change failed: {response.status_code}"
        
        print(f"PASS: Tournament status change Intéressé → Participant completed without freeze")


class TestObservationsFeature:
    """FEATURE #1: Test observations with ComposerBox functionality"""
    
    def test_add_observation_to_event(self):
        """BUG #1 related: Test observation can be added successfully"""
        # Get events
        response = requests.get(f"{BASE_URL}/api/events?month=2026-02")
        assert response.status_code == 200
        
        events = response.json()
        if not events:
            pytest.skip("No events available for testing observations")
        
        event_id = events[0]['id']
        
        # Add observation
        obs_data = {
            "author": "Test Coach",
            "role": "Tester",
            "text": f"Test observation {uuid.uuid4().hex[:6]}"
        }
        
        response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=obs_data)
        assert response.status_code == 200, f"Add observation failed: {response.status_code}"
        
        observation = response.json()
        assert observation.get('id'), "Observation should have an ID"
        assert observation.get('text') == obs_data['text'], "Observation text should match"
        
        print(f"PASS: Observation added successfully to event {event_id}")
    
    def test_add_observation_with_parentid(self):
        """BUG #1 related: Test threaded replies work"""
        # Get events with observations
        response = requests.get(f"{BASE_URL}/api/events?month=2026-02")
        assert response.status_code == 200
        
        events = response.json()
        events_with_obs = [e for e in events if e.get('observations') and len(e['observations']) > 0]
        
        if not events_with_obs:
            pytest.skip("No events with observations found")
        
        event = events_with_obs[0]
        event_id = event['id']
        parent_obs_id = event['observations'][0]['id']
        
        # Add reply observation
        reply_data = {
            "author": "Reply Tester",
            "role": "Tester",
            "text": f"Reply to observation {uuid.uuid4().hex[:6]}",
            "parentId": parent_obs_id
        }
        
        response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=reply_data)
        assert response.status_code == 200, f"Add reply failed: {response.status_code}"
        
        reply = response.json()
        assert reply.get('parentId') == parent_obs_id, "Reply should have parentId set"
        
        print(f"PASS: Reply observation with parentId={parent_obs_id} added successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
