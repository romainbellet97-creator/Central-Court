"""
Data Isolation Tests - Testing that users can ONLY access their own data
Tests for: events, alerts, documents, preferences
Security fix verification for DB-4
"""

import pytest
import requests
import os
from datetime import datetime, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com')

# MongoDB setup for creating test users/sessions
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "central_court"


@pytest.fixture(scope="module")
def mongo_client():
    """Connect to MongoDB for direct operations"""
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def test_users(mongo_client):
    """Create two test users with sessions and return their tokens"""
    db = mongo_client
    
    # Cleanup any existing test users
    db.users.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    db.user_sessions.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    
    # Create User A
    db.users.insert_one({
        "user_id": "test-user-a",
        "email": "usera@test.com",
        "name": "User A",
        "role": "player"
    })
    
    # Create User B  
    db.users.insert_one({
        "user_id": "test-user-b",
        "email": "userb@test.com", 
        "name": "User B",
        "role": "player"
    })
    
    # Create sessions that expire in 2027
    expires_at = datetime(2027, 1, 1)
    
    db.user_sessions.insert_one({
        "user_id": "test-user-a",
        "session_token": "test-token-a-isolation",
        "expires_at": expires_at,
        "created_at": datetime.now()
    })
    
    db.user_sessions.insert_one({
        "user_id": "test-user-b",
        "session_token": "test-token-b-isolation",
        "expires_at": expires_at,
        "created_at": datetime.now()
    })
    
    yield {
        "user_a": {
            "user_id": "test-user-a",
            "token": "test-token-a-isolation"
        },
        "user_b": {
            "user_id": "test-user-b", 
            "token": "test-token-b-isolation"
        }
    }
    
    # Cleanup after tests
    db.users.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    db.user_sessions.delete_many({"user_id": {"$in": ["test-user-a", "test-user-b"]}})
    # Cleanup test data
    db.events.delete_many({"userId": {"$in": ["test-user-a", "test-user-b"]}})
    db.alerts.delete_many({"userId": {"$in": ["test-user-a", "test-user-b"]}})
    db.documents.delete_many({"userId": {"$in": ["test-user-a", "test-user-b"]}})
    db.user_preferences.delete_many({"userId": {"$in": ["test-user-a", "test-user-b"]}})


def get_headers(token):
    """Return headers with Bearer token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }


# =============================================================================
# EVENT ISOLATION TESTS
# =============================================================================

class TestEventIsolation:
    """Tests for event data isolation"""
    
    def test_get_events_returns_only_own_events(self, test_users, mongo_client):
        """User A should only see User A's events, not User B's"""
        # Create event for User A
        response_a = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "training",
                "title": "User A Training",
                "date": "2026-01-15"
            }
        )
        assert response_a.status_code == 200, f"Create event A failed: {response_a.text}"
        event_a = response_a.json()
        assert event_a["userId"] == "test-user-a", "Event should be created with User A's userId"
        
        # Create event for User B
        response_b = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_b"]["token"]),
            json={
                "type": "match",
                "title": "User B Match",
                "date": "2026-01-16"
            }
        )
        assert response_b.status_code == 200, f"Create event B failed: {response_b.text}"
        event_b = response_b.json()
        assert event_b["userId"] == "test-user-b", "Event should be created with User B's userId"
        
        # User A lists events - should only see their own
        list_response_a = requests.get(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert list_response_a.status_code == 200
        events_a = list_response_a.json()
        
        # Verify User A only sees their events
        user_ids_seen = {e.get("userId") for e in events_a}
        assert "test-user-b" not in user_ids_seen, "User A should NOT see User B's events!"
        assert any(e["id"] == event_a["id"] for e in events_a), "User A should see their own event"
        
        # User B lists events - should only see their own
        list_response_b = requests.get(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert list_response_b.status_code == 200
        events_b = list_response_b.json()
        
        user_ids_seen_b = {e.get("userId") for e in events_b}
        assert "test-user-a" not in user_ids_seen_b, "User B should NOT see User A's events!"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_a['id']}", headers=get_headers(test_users["user_a"]["token"]))
        requests.delete(f"{BASE_URL}/api/events/{event_b['id']}", headers=get_headers(test_users["user_b"]["token"]))

    def test_update_event_access_denied_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when trying to update User A's event"""
        # Create event for User A
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "training",
                "title": "User A Private Event",
                "date": "2026-01-20"
            }
        )
        assert response.status_code == 200
        event_a = response.json()
        
        # User B tries to update User A's event
        update_response = requests.put(
            f"{BASE_URL}/api/events/{event_a['id']}",
            headers=get_headers(test_users["user_b"]["token"]),
            json={"title": "Hacked by User B"}
        )
        assert update_response.status_code == 403, f"Expected 403 Access Denied, got {update_response.status_code}: {update_response.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_a['id']}", headers=get_headers(test_users["user_a"]["token"]))

    def test_delete_event_access_denied_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when trying to delete User A's event"""
        # Create event for User A
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "match",
                "title": "User A Important Match",
                "date": "2026-01-25"
            }
        )
        assert response.status_code == 200
        event_a = response.json()
        
        # User B tries to delete User A's event
        delete_response = requests.delete(
            f"{BASE_URL}/api/events/{event_a['id']}",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert delete_response.status_code == 403, f"Expected 403 Access Denied, got {delete_response.status_code}"
        
        # Verify event still exists
        get_response = requests.get(
            f"{BASE_URL}/api/events/{event_a['id']}",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert get_response.status_code == 200, "Event should still exist after unauthorized delete attempt"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_a['id']}", headers=get_headers(test_users["user_a"]["token"]))

    def test_add_observation_access_denied_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when trying to add observation to User A's event"""
        # Create event for User A
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "training",
                "title": "User A Training Session",
                "date": "2026-01-30"
            }
        )
        assert response.status_code == 200
        event_a = response.json()
        
        # User B tries to add observation
        obs_response = requests.post(
            f"{BASE_URL}/api/events/{event_a['id']}/observations",
            headers=get_headers(test_users["user_b"]["token"]),
            json={
                "author": "Hacker B",
                "role": "attacker",
                "text": "Unauthorized observation"
            }
        )
        assert obs_response.status_code == 403, f"Expected 403, got {obs_response.status_code}: {obs_response.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_a['id']}", headers=get_headers(test_users["user_a"]["token"]))


# =============================================================================
# ALERT ISOLATION TESTS
# =============================================================================

class TestAlertIsolation:
    """Tests for alert data isolation"""
    
    def test_get_alerts_returns_only_own_alerts(self, test_users, mongo_client):
        """User A should only see their own alerts"""
        # Create alert for User A
        response_a = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "reminder",
                "title": "User A Reminder",
                "message": "User A's personal alert",
                "priority": "medium"
            }
        )
        assert response_a.status_code == 200, f"Create alert A failed: {response_a.text}"
        alert_a = response_a.json()
        assert alert_a["userId"] == "test-user-a", "Alert should be created with User A's userId"
        
        # Create alert for User B
        response_b = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_b"]["token"]),
            json={
                "type": "reminder",
                "title": "User B Reminder",
                "message": "User B's personal alert",
                "priority": "high"
            }
        )
        assert response_b.status_code == 200
        alert_b = response_b.json()
        
        # User A lists alerts - should only see their own
        list_response = requests.get(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert list_response.status_code == 200
        alerts_a = list_response.json()
        
        user_ids_seen = {a.get("userId") for a in alerts_a}
        assert "test-user-b" not in user_ids_seen, "User A should NOT see User B's alerts!"
        
        # Cleanup via direct MongoDB (alerts don't have delete endpoint)
        mongo_client.alerts.delete_many({"id": {"$in": [alert_a["id"], alert_b["id"]]}})

    def test_mark_alert_read_returns_404_for_other_user(self, test_users, mongo_client):
        """User B should get 404 when trying to mark User A's alert as read"""
        # Create alert for User A
        response = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "reminder",
                "title": "Private Alert",
                "message": "Only User A should access this",
                "priority": "low"
            }
        )
        assert response.status_code == 200
        alert_a = response.json()
        
        # User B tries to mark it as read
        read_response = requests.put(
            f"{BASE_URL}/api/alerts/{alert_a['id']}/read",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert read_response.status_code == 404, f"Expected 404, got {read_response.status_code}"
        
        # Verify alert still unread for User A
        list_response = requests.get(
            f"{BASE_URL}/api/alerts?unread_only=true",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert any(a["id"] == alert_a["id"] for a in list_response.json()), "Alert should still be unread"
        
        # Cleanup
        mongo_client.alerts.delete_one({"id": alert_a["id"]})

    def test_dismiss_alert_returns_404_for_other_user(self, test_users, mongo_client):
        """User B should get 404 when trying to dismiss User A's alert"""
        # Create alert for User A
        response = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "flight_missing",
                "title": "Book Flight",
                "message": "Flight needed for tournament",
                "priority": "high"
            }
        )
        assert response.status_code == 200
        alert_a = response.json()
        
        # User B tries to dismiss it
        dismiss_response = requests.put(
            f"{BASE_URL}/api/alerts/{alert_a['id']}/dismiss",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert dismiss_response.status_code == 404, f"Expected 404, got {dismiss_response.status_code}"
        
        # Cleanup
        mongo_client.alerts.delete_one({"id": alert_a["id"]})

    def test_mark_all_read_only_affects_own_alerts(self, test_users, mongo_client):
        """mark_all_read should only mark current user's alerts"""
        # Create unread alerts for both users
        resp_a = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_a"]["token"]),
            json={"type": "reminder", "title": "Alert A", "message": "A", "priority": "low"}
        )
        alert_a = resp_a.json()
        
        resp_b = requests.post(
            f"{BASE_URL}/api/alerts",
            headers=get_headers(test_users["user_b"]["token"]),
            json={"type": "reminder", "title": "Alert B", "message": "B", "priority": "low"}
        )
        alert_b = resp_b.json()
        
        # User A marks all as read
        requests.put(
            f"{BASE_URL}/api/alerts/read-all",
            headers=get_headers(test_users["user_a"]["token"])
        )
        
        # Verify User B's alert is still unread
        db_alert_b = mongo_client.alerts.find_one({"id": alert_b["id"]})
        assert db_alert_b["read"] == False, "User B's alert should still be unread after User A's read-all"
        
        # Verify User A's alert is read
        db_alert_a = mongo_client.alerts.find_one({"id": alert_a["id"]})
        assert db_alert_a["read"] == True, "User A's alert should be marked as read"
        
        # Cleanup
        mongo_client.alerts.delete_many({"id": {"$in": [alert_a["id"], alert_b["id"]]}})


# =============================================================================
# DOCUMENT ISOLATION TESTS
# =============================================================================

class TestDocumentIsolation:
    """Tests for document data isolation"""
    
    def test_get_documents_returns_only_own_documents(self, test_users, mongo_client):
        """User A should only see their own documents"""
        # Create document for User A
        response_a = requests.post(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "name": "User A Invoice",
                "category": "travel",
                "montantTotal": 150.00
            }
        )
        assert response_a.status_code == 200, f"Create doc A failed: {response_a.text}"
        doc_a = response_a.json()
        assert doc_a["userId"] == "test-user-a", f"Doc should have userId=test-user-a, got {doc_a.get('userId')}"
        
        # Create document for User B
        response_b = requests.post(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_b"]["token"]),
            json={
                "name": "User B Receipt",
                "category": "medical",
                "montantTotal": 75.00
            }
        )
        assert response_b.status_code == 200
        doc_b = response_b.json()
        
        # User A lists documents - should only see their own
        list_response = requests.get(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert list_response.status_code == 200
        docs_a = list_response.json()
        
        user_ids_seen = {d.get("userId") for d in docs_a}
        assert "test-user-b" not in user_ids_seen, "User A should NOT see User B's documents!"
        assert any(d["id"] == doc_a["id"] for d in docs_a), "User A should see their own document"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc_a['id']}", headers=get_headers(test_users["user_a"]["token"]))
        requests.delete(f"{BASE_URL}/api/documents/{doc_b['id']}", headers=get_headers(test_users["user_b"]["token"]))

    def test_get_document_by_id_returns_403_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when accessing User A's document by ID"""
        # Create document for User A
        response = requests.post(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "name": "Confidential Doc A",
                "category": "services",
                "montantTotal": 500.00
            }
        )
        assert response.status_code == 200
        doc_a = response.json()
        
        # User B tries to access it
        get_response = requests.get(
            f"{BASE_URL}/api/documents/{doc_a['id']}",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert get_response.status_code == 403, f"Expected 403, got {get_response.status_code}: {get_response.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc_a['id']}", headers=get_headers(test_users["user_a"]["token"]))

    def test_update_document_returns_403_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when trying to update User A's document"""
        # Create document for User A
        response = requests.post(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "name": "User A Financial Doc",
                "category": "other",
                "montantTotal": 1000.00
            }
        )
        assert response.status_code == 200
        doc_a = response.json()
        
        # User B tries to update it
        update_response = requests.put(
            f"{BASE_URL}/api/documents/{doc_a['id']}",
            headers=get_headers(test_users["user_b"]["token"]),
            json={"name": "Hacked Document", "montantTotal": 0.01}
        )
        assert update_response.status_code == 403, f"Expected 403, got {update_response.status_code}"
        
        # Verify document unchanged
        get_response = requests.get(
            f"{BASE_URL}/api/documents/{doc_a['id']}",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert get_response.json()["montantTotal"] == 1000.00, "Document should be unchanged"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc_a['id']}", headers=get_headers(test_users["user_a"]["token"]))

    def test_delete_document_returns_403_for_other_user(self, test_users, mongo_client):
        """User B should get 403 when trying to delete User A's document"""
        # Create document for User A
        response = requests.post(
            f"{BASE_URL}/api/documents",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "name": "User A Important Receipt",
                "category": "travel",
                "montantTotal": 250.00
            }
        )
        assert response.status_code == 200
        doc_a = response.json()
        
        # User B tries to delete it
        delete_response = requests.delete(
            f"{BASE_URL}/api/documents/{doc_a['id']}",
            headers=get_headers(test_users["user_b"]["token"])
        )
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}"
        
        # Verify document still exists
        get_response = requests.get(
            f"{BASE_URL}/api/documents/{doc_a['id']}",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert get_response.status_code == 200, "Document should still exist"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/documents/{doc_a['id']}", headers=get_headers(test_users["user_a"]["token"]))


# =============================================================================
# PREFERENCE ISOLATION TESTS
# =============================================================================

class TestPreferenceIsolation:
    """Tests for user preference isolation"""
    
    def test_get_preferences_returns_own_user_id(self, test_users, mongo_client):
        """GET preferences should return current user's userId, not demo-user"""
        # Get preferences for User A
        response = requests.get(
            f"{BASE_URL}/api/preferences",
            headers=get_headers(test_users["user_a"]["token"])
        )
        assert response.status_code == 200
        prefs = response.json()
        
        # Should NOT be demo-user
        assert prefs["userId"] != "demo-user", "Preferences should not be for demo-user!"
        assert prefs["userId"] == "test-user-a", f"Expected userId=test-user-a, got {prefs['userId']}"

    def test_update_preferences_only_updates_own(self, test_users, mongo_client):
        """PUT preferences should only update current user's preferences"""
        # User A sets preferences
        update_a = requests.put(
            f"{BASE_URL}/api/preferences",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "voyage": {"travelClass": "business", "airlines": ["Air France"]},
                "hotel": {"amenities": ["pool", "gym"]},
                "food": {"cuisines": ["French"], "restrictions": []}
            }
        )
        assert update_a.status_code == 200
        
        # User B sets different preferences
        update_b = requests.put(
            f"{BASE_URL}/api/preferences",
            headers=get_headers(test_users["user_b"]["token"]),
            json={
                "voyage": {"travelClass": "economy", "airlines": ["Ryanair"]},
                "hotel": {"amenities": ["wifi"]},
                "food": {"cuisines": ["Italian"], "restrictions": ["vegetarian"]}
            }
        )
        assert update_b.status_code == 200
        
        # Verify User A's preferences are unchanged
        get_a = requests.get(
            f"{BASE_URL}/api/preferences",
            headers=get_headers(test_users["user_a"]["token"])
        )
        prefs_a = get_a.json()
        assert prefs_a["voyage"]["travelClass"] == "business", "User A's travel class should be business"
        assert "Air France" in prefs_a["voyage"]["airlines"], "User A should have Air France"
        
        # Verify User B has their own preferences
        get_b = requests.get(
            f"{BASE_URL}/api/preferences",
            headers=get_headers(test_users["user_b"]["token"])
        )
        prefs_b = get_b.json()
        assert prefs_b["voyage"]["travelClass"] == "economy", "User B's travel class should be economy"
        assert prefs_b["userId"] == "test-user-b"
        
        # Cleanup
        mongo_client.user_preferences.delete_many({"userId": {"$in": ["test-user-a", "test-user-b"]}})


# =============================================================================
# UNAUTHENTICATED/DEFAULT-USER TESTS
# =============================================================================

class TestUnauthenticatedAccess:
    """Test behavior for unauthenticated requests (should get default-user)"""
    
    def test_unauthenticated_events_returns_default_user_events_only(self, test_users, mongo_client):
        """Without auth, should only see default-user events (if any)"""
        # Create event as authenticated user
        response = requests.post(
            f"{BASE_URL}/api/events",
            headers=get_headers(test_users["user_a"]["token"]),
            json={
                "type": "match",
                "title": "Auth User Event",
                "date": "2026-02-01"
            }
        )
        event_a = response.json()
        
        # List events without auth
        list_response = requests.get(f"{BASE_URL}/api/events")
        assert list_response.status_code == 200
        events = list_response.json()
        
        # Should NOT see authenticated user's event
        event_ids = [e["id"] for e in events]
        assert event_a["id"] not in event_ids, "Unauthenticated should NOT see User A's event"
        
        # All returned events should be for default-user (or empty)
        for e in events:
            assert e.get("userId") == "default-user" or e.get("userId") is None, \
                f"Unauthenticated should only see default-user events, got userId={e.get('userId')}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/events/{event_a['id']}", headers=get_headers(test_users["user_a"]["token"]))

    def test_unauthenticated_preferences_returns_default_user(self, test_users):
        """Without auth, preferences should be for default-user"""
        response = requests.get(f"{BASE_URL}/api/preferences")
        assert response.status_code == 200
        prefs = response.json()
        assert prefs["userId"] == "default-user", f"Expected default-user, got {prefs['userId']}"
