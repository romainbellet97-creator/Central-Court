"""
Sprint 3 - Backend API Tests for Event Features
Tests:
- FEATURE #1: Observations with parentId (threaded replies)
- FEATURE #2: Staff notification (notify_staff) and pending_validation
- FEATURE #3: Events with endTime support
- API CRUD: GET, POST, PUT, DELETE events
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com').rstrip('/')


class TestEventsCRUD:
    """Test basic CRUD operations for events"""

    def test_create_event_basic(self):
        """Test creating a basic event"""
        unique_id = uuid.uuid4().hex[:6]
        payload = {
            "type": "training",
            "title": f"TEST_Training_Session_{unique_id}",
            "date": "2026-02-25",
            "time": "09:00",
            "location": "Court A",
            "description": "Morning training session"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert data["title"] == payload["title"], f"Title mismatch: {data['title']} != {payload['title']}"
        assert data["type"] == payload["type"], f"Type mismatch"
        assert data["date"] == payload["date"], f"Date mismatch"
        assert data["time"] == payload["time"], f"Time mismatch"
        
        # Store event ID for cleanup
        self.__class__.created_event_id = data["id"]
        print(f"✓ Created event with ID: {data['id']}")
        return data["id"]

    def test_get_event_by_id(self):
        """Test fetching event by ID"""
        # First create an event
        unique_id = uuid.uuid4().hex[:6]
        create_payload = {
            "type": "match",
            "title": f"TEST_Match_{unique_id}",
            "date": "2026-02-26",
            "time": "14:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=create_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Fetch the event
        response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == event_id, f"ID mismatch: {data['id']} != {event_id}"
        assert data["title"] == create_payload["title"], "Title should match"
        print(f"✓ Fetched event by ID: {event_id}")

    def test_list_events_by_month(self):
        """Test listing events filtered by month (YYYY-MM)"""
        # Create event for specific month
        unique_id = uuid.uuid4().hex[:6]
        payload = {
            "type": "meeting",
            "title": f"TEST_Meeting_{unique_id}",
            "date": "2026-03-15",
            "time": "10:00"
        }
        requests.post(f"{BASE_URL}/api/events", json=payload)
        
        # Fetch events by month
        response = requests.get(f"{BASE_URL}/api/events?month=2026-03")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} events for month 2026-03")

    def test_update_event(self):
        """Test updating an event"""
        # First create an event
        unique_id = uuid.uuid4().hex[:6]
        create_payload = {
            "type": "training",
            "title": f"TEST_Original_Title_{unique_id}",
            "date": "2026-02-27",
            "time": "11:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=create_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Update the event
        update_payload = {
            "title": f"TEST_Updated_Title_{unique_id}",
            "time": "12:00",
            "location": "Court B"
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == update_payload["title"], f"Title not updated"
        assert data["time"] == update_payload["time"], f"Time not updated"
        assert data["location"] == update_payload["location"], f"Location not updated"
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["title"] == update_payload["title"], "Update not persisted"
        print(f"✓ Updated event: {event_id}")

    def test_delete_event(self):
        """Test deleting an event"""
        # First create an event
        unique_id = uuid.uuid4().hex[:6]
        create_payload = {
            "type": "meeting",
            "title": f"TEST_ToBeDeleted_{unique_id}",
            "date": "2026-02-28"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=create_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Delete the event
        response = requests.delete(f"{BASE_URL}/api/events/{event_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify event is deleted with GET
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 404, f"Event should be deleted, but GET returned {get_response.status_code}"
        print(f"✓ Deleted event: {event_id}")

    def test_get_nonexistent_event(self):
        """Test fetching a non-existent event returns 404"""
        response = requests.get(f"{BASE_URL}/api/events/nonexistent-event-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent event returns 404")


class TestFeature1Observations:
    """FEATURE #1: Observations with parentId support for threaded replies"""

    def test_add_observation_basic(self):
        """Test adding a basic observation to an event"""
        # Create an event first
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "match",
            "title": f"TEST_Match_For_Obs_{unique_id}",
            "date": "2026-03-01",
            "time": "15:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Add observation
        obs_payload = {
            "author": "Coach Martin",
            "role": "coach",
            "text": "Player showed good form during warm-up"
        }
        response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=obs_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Observation should have an ID"
        assert data["author"] == obs_payload["author"], "Author mismatch"
        assert data["role"] == obs_payload["role"], "Role mismatch"
        assert data["text"] == obs_payload["text"], "Text mismatch"
        assert "createdAt" in data, "Should have createdAt timestamp"
        
        self.__class__.parent_observation_id = data["id"]
        self.__class__.event_with_observation = event_id
        print(f"✓ Added observation to event: {event_id}")
        return data["id"], event_id

    def test_add_observation_with_parentId(self):
        """Test adding a reply observation with parentId"""
        # Create event and parent observation
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "training",
            "title": f"TEST_Training_For_Reply_{unique_id}",
            "date": "2026-03-02",
            "time": "10:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Add parent observation
        parent_obs_payload = {
            "author": "Coach Martin",
            "role": "coach",
            "text": "We need to work on backhand technique"
        }
        parent_response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=parent_obs_payload)
        assert parent_response.status_code == 200
        parent_id = parent_response.json()["id"]
        
        # Add reply with parentId (FEATURE #1)
        reply_payload = {
            "author": "Player Jean",
            "role": "player",
            "text": "I agree, let's focus on that tomorrow",
            "parentId": parent_id
        }
        response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=reply_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Reply observation should have an ID"
        assert data["parentId"] == parent_id, f"parentId should be {parent_id}, got {data.get('parentId')}"
        assert data["author"] == reply_payload["author"], "Author mismatch"
        assert data["text"] == reply_payload["text"], "Text mismatch"
        print(f"✓ Added reply observation with parentId: {parent_id}")
        
        # Verify observations are persisted in event
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 200
        event_data = get_response.json()
        observations = event_data.get("observations", [])
        assert len(observations) >= 2, f"Expected at least 2 observations, got {len(observations)}"
        
        # Verify parentId is stored
        reply_obs = next((obs for obs in observations if obs.get("parentId") == parent_id), None)
        assert reply_obs is not None, "Reply observation with parentId not found in event"
        print("✓ Verified reply observation with parentId is persisted")

    def test_add_observation_with_null_parentId(self):
        """Test adding observation with parentId=null (top-level comment)"""
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "meeting",
            "title": f"TEST_Meeting_NullParent_{unique_id}",
            "date": "2026-03-03",
            "time": "09:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Add observation with explicit null parentId
        obs_payload = {
            "author": "Admin",
            "role": "admin",
            "text": "Meeting rescheduled to next week",
            "parentId": None
        }
        response = requests.post(f"{BASE_URL}/api/events/{event_id}/observations", json=obs_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("parentId") is None, f"parentId should be None, got {data.get('parentId')}"
        print("✓ Added observation with null parentId (top-level)")

    def test_add_observation_to_nonexistent_event(self):
        """Test adding observation to non-existent event returns 404"""
        obs_payload = {
            "author": "Test",
            "role": "admin",
            "text": "This should fail"
        }
        response = requests.post(f"{BASE_URL}/api/events/nonexistent-event-xyz/observations", json=obs_payload)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Adding observation to non-existent event returns 404")


class TestFeature2StaffNotification:
    """FEATURE #2: Staff notification (notify_staff) and pending_validation"""

    def test_update_event_with_notify_staff(self):
        """Test updating event with notify_staff=true creates notification"""
        # Create event with assigned staff
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "training",
            "title": f"TEST_Training_Notify_{unique_id}",
            "date": "2026-03-05",
            "time": "14:00",
            "assignedStaffIds": ["staff-001", "staff-002"]
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Update event with notify_staff=true
        update_payload = {
            "date": "2026-03-06",
            "time": "15:00",
            "notify_staff": True
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["date"] == update_payload["date"], "Date should be updated"
        assert data["time"] == update_payload["time"], "Time should be updated"
        
        # Note: notify_staff should not be stored in event, it's a trigger for notification
        assert "notify_staff" not in data or data.get("notify_staff") is None, "notify_staff should not persist in event"
        print(f"✓ Updated event with notify_staff=true: {event_id}")

    def test_update_event_with_pending_validation(self):
        """Test updating event with pending_validation=true"""
        # Create event
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "match",
            "title": f"TEST_Match_Pending_{unique_id}",
            "date": "2026-03-07",
            "time": "10:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Update event with pending_validation=true
        update_payload = {
            "pending_validation": True
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("pending_validation") == True, f"pending_validation should be True, got {data.get('pending_validation')}"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("pending_validation") == True, "pending_validation should persist"
        print(f"✓ Set pending_validation=true for event: {event_id}")

    def test_update_event_clear_pending_validation(self):
        """Test clearing pending_validation by setting to false"""
        # Create event with pending_validation
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "meeting",
            "title": f"TEST_Meeting_ClearPending_{unique_id}",
            "date": "2026-03-08",
            "time": "11:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # First set pending_validation=true
        requests.put(f"{BASE_URL}/api/events/{event_id}", json={"pending_validation": True})
        
        # Then clear it
        update_payload = {
            "pending_validation": False
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("pending_validation") == False, f"pending_validation should be False, got {data.get('pending_validation')}"
        print(f"✓ Cleared pending_validation for event: {event_id}")


class TestFeature3EndTime:
    """FEATURE #3: Events with endTime support"""

    def test_create_event_with_endTime(self):
        """Test creating an event with endTime"""
        unique_id = uuid.uuid4().hex[:6]
        payload = {
            "type": "training",
            "title": f"TEST_Training_EndTime_{unique_id}",
            "date": "2026-03-10",
            "time": "09:00",
            "endTime": "11:30",
            "location": "Main Court"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("time") == "09:00", f"time should be 09:00, got {data.get('time')}"
        assert data.get("endTime") == "11:30", f"endTime should be 11:30, got {data.get('endTime')}"
        
        # Verify persistence
        event_id = data["id"]
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("endTime") == "11:30", "endTime should persist"
        print(f"✓ Created event with endTime: {event_id}")

    def test_update_event_with_endTime(self):
        """Test updating an event's endTime"""
        # Create event without endTime
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "match",
            "title": f"TEST_Match_UpdateEndTime_{unique_id}",
            "date": "2026-03-11",
            "time": "14:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Update with endTime
        update_payload = {
            "endTime": "16:00"
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("endTime") == "16:00", f"endTime should be 16:00, got {data.get('endTime')}"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/events/{event_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("endTime") == "16:00", "endTime update should persist"
        print(f"✓ Updated event with endTime: {event_id}")

    def test_create_event_with_time_range(self):
        """Test creating an event with full time range (time and endTime)"""
        unique_id = uuid.uuid4().hex[:6]
        payload = {
            "type": "tournament",
            "title": f"TEST_Tournament_TimeRange_{unique_id}",
            "date": "2026-03-12",
            "endDate": "2026-03-14",
            "time": "08:00",
            "endTime": "20:00",
            "location": "Tennis Center"
        }
        response = requests.post(f"{BASE_URL}/api/events", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("time") == "08:00", "Start time mismatch"
        assert data.get("endTime") == "20:00", "End time mismatch"
        assert data.get("date") == "2026-03-12", "Start date mismatch"
        assert data.get("endDate") == "2026-03-14", "End date mismatch"
        print(f"✓ Created event with full time range: {data['id']}")

    def test_update_event_time_and_endTime_together(self):
        """Test updating both time and endTime together"""
        # Create event
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "training",
            "title": f"TEST_Training_BothTimes_{unique_id}",
            "date": "2026-03-13",
            "time": "10:00",
            "endTime": "12:00"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Update both times
        update_payload = {
            "time": "11:00",
            "endTime": "13:30"
        }
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json=update_payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("time") == "11:00", f"time should be 11:00, got {data.get('time')}"
        assert data.get("endTime") == "13:30", f"endTime should be 13:30, got {data.get('endTime')}"
        print(f"✓ Updated both time and endTime for event: {event_id}")


class TestEdgeCases:
    """Edge cases and error handling tests"""

    def test_update_nonexistent_event(self):
        """Test updating a non-existent event returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/events/nonexistent-event-xyz", 
            json={"title": "New Title"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Updating non-existent event returns 404")

    def test_delete_nonexistent_event(self):
        """Test deleting a non-existent event returns 404"""
        response = requests.delete(f"{BASE_URL}/api/events/nonexistent-event-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Deleting non-existent event returns 404")

    def test_update_with_empty_body(self):
        """Test updating with empty body returns error"""
        # Create event first
        unique_id = uuid.uuid4().hex[:6]
        event_payload = {
            "type": "meeting",
            "title": f"TEST_Meeting_EmptyUpdate_{unique_id}",
            "date": "2026-03-15"
        }
        create_response = requests.post(f"{BASE_URL}/api/events", json=event_payload)
        assert create_response.status_code == 200
        event_id = create_response.json()["id"]
        
        # Try to update with empty body
        response = requests.put(f"{BASE_URL}/api/events/{event_id}", json={})
        
        assert response.status_code == 400, f"Expected 400 for empty update, got {response.status_code}"
        print("✓ Updating with empty body returns 400")

    def test_list_events_no_filter(self):
        """Test listing all events without filter"""
        response = requests.get(f"{BASE_URL}/api/events")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Listed {len(data)} events (no filter)")


# Cleanup fixture to run after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_events():
    """Cleanup TEST_ prefixed events after module completes"""
    yield
    # Teardown: Get all events and delete TEST_ ones
    try:
        response = requests.get(f"{BASE_URL}/api/events")
        if response.status_code == 200:
            events = response.json()
            for event in events:
                if event.get("title", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/events/{event['id']}")
            print(f"✓ Cleaned up TEST_ events")
    except Exception as e:
        print(f"Cleanup warning: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
