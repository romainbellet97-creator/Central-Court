"""
Sprint 3 Bug Fixes - Backend Tests for Observations API
Tests for:
- BUG #1: Author name correctly stored (currentUser.name)
- BUG #2: Observation creation for send status workflow
- POST /api/events/{id}/observations API endpoint
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://multi-tenant-secure-2.preview.emergentagent.com')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_event(api_client):
    """Create a test event for observations testing"""
    event_data = {
        "type": "training",
        "title": "TEST_Sprint3_Training_Session",
        "date": "2026-02-15",
        "time": "09:00",
        "endTime": "10:30",
        "location": "Court Central",
        "description": "Training for sprint 3 observation tests"
    }
    response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
    assert response.status_code == 200, f"Failed to create test event: {response.text}"
    event = response.json()
    yield event
    # Cleanup
    api_client.delete(f"{BASE_URL}/api/events/{event['id']}")


class TestObservationsAPI:
    """Test observations API - critical for Bug #1 and #2 workflow"""

    def test_add_observation_with_author_name(self, api_client, test_event):
        """BUG #1: Verify author name is correctly stored (not hardcoded)"""
        event_id = test_event['id']
        
        # Simulate what frontend sends - with REAL user name (not hardcoded)
        observation_data = {
            "author": "Jean Dupont",  # This should be currentUser.name
            "role": "Joueur",
            "text": "Bonne session d'entraînement aujourd'hui",
            "parentId": None
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=observation_data)
        assert response.status_code == 200, f"Failed to add observation: {response.text}"
        
        observation = response.json()
        
        # Verify response structure
        assert "id" in observation, "Observation should have an ID"
        assert observation["author"] == "Jean Dupont", f"Author should be 'Jean Dupont', got {observation['author']}"
        assert observation["role"] == "Joueur", f"Role should be 'Joueur', got {observation['role']}"
        assert observation["text"] == "Bonne session d'entraînement aujourd'hui"
        assert "createdAt" in observation
        
        print(f"✅ BUG #1 TEST: Observation created with correct author name: {observation['author']}")

    def test_observation_persisted_in_event(self, api_client, test_event):
        """Verify observation is actually stored in the event"""
        event_id = test_event['id']
        
        # Add observation
        observation_data = {
            "author": "Marie Coach",
            "role": "Staff Technique",
            "text": "TEST_Observation_Persistence_Check"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=observation_data)
        assert response.status_code == 200
        new_obs = response.json()
        
        # GET event to verify observation was persisted
        response = api_client.get(f"{BASE_URL}/api/events/{event_id}")
        assert response.status_code == 200
        
        event = response.json()
        assert "observations" in event
        assert len(event["observations"]) > 0
        
        # Find our observation
        found = False
        for obs in event["observations"]:
            if obs.get("text") == "TEST_Observation_Persistence_Check":
                assert obs["author"] == "Marie Coach"
                assert obs["role"] == "Staff Technique"
                found = True
                break
        
        assert found, "Observation was not persisted in event"
        print(f"✅ Observation correctly persisted in event with {len(event['observations'])} observations")

    def test_observation_supports_parentId_for_replies(self, api_client, test_event):
        """Verify parentId field for reply functionality"""
        event_id = test_event['id']
        
        # First observation (parent)
        parent_obs = {
            "author": "Coach Principal",
            "role": "Entraîneur",
            "text": "Comment s'est passée la séance ?",
            "parentId": None
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=parent_obs)
        assert response.status_code == 200
        parent = response.json()
        
        # Reply observation
        reply_obs = {
            "author": "Jean Joueur",
            "role": "Joueur",
            "text": "Très bien, j'ai travaillé mon service",
            "parentId": parent["id"]  # Linking to parent
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=reply_obs)
        assert response.status_code == 200
        reply = response.json()
        
        assert reply["parentId"] == parent["id"], f"Reply parentId should be {parent['id']}, got {reply.get('parentId')}"
        print(f"✅ Reply observation correctly linked to parent: {reply['parentId']}")

    def test_observation_not_found_event(self, api_client):
        """Test adding observation to non-existent event"""
        observation_data = {
            "author": "Test User",
            "role": "Joueur",
            "text": "Test observation"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/non-existent-event/observations", json=observation_data)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for non-existent event")


class TestBug1AuthorNameFlow:
    """Specific tests for BUG #1: Author name should be currentUser.name"""

    def test_different_authors_stored_correctly(self, api_client, test_event):
        """Multiple users with different names should be stored correctly"""
        event_id = test_event['id']
        
        authors_to_test = [
            {"author": "Pierre Martin", "role": "Agent"},
            {"author": "Sophie Dubois", "role": "Kinésithérapeute"},
            {"author": "Le Joueur Actuel", "role": "Joueur"},  # Real user name
        ]
        
        for author_data in authors_to_test:
            obs_data = {
                **author_data,
                "text": f"Observation de {author_data['author']}"
            }
            
            response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=obs_data)
            assert response.status_code == 200
            
            result = response.json()
            assert result["author"] == author_data["author"], \
                f"Author mismatch: expected '{author_data['author']}', got '{result['author']}'"
        
        print("✅ BUG #1: All different author names stored correctly")


class TestBug2SendStatusWorkflow:
    """Tests verifying the send status workflow works correctly"""

    def test_observation_created_immediately(self, api_client, test_event):
        """BUG #2: Verify observation is created successfully (for sending→sent workflow)"""
        event_id = test_event['id']
        
        # This simulates what happens when sendStatus transitions from SENDING to SENT
        obs_data = {
            "author": "Test Player",
            "role": "Joueur",
            "text": f"TEST_SendStatus_{uuid.uuid4().hex[:6]}"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events/{event_id}/observations", json=obs_data)
        
        # Response should be immediate (for optimistic UI update)
        assert response.status_code == 200, f"Observation should be created: {response.text}"
        
        result = response.json()
        assert "id" in result, "Should have ID for replacing temp ID"
        assert "createdAt" in result, "Should have createdAt timestamp"
        
        print(f"✅ BUG #2: Observation created with real ID {result['id']} - allows sendStatus transition")


class TestEventAPI:
    """General event API tests"""

    def test_create_event_with_endTime(self, api_client):
        """Test FEATURE #3: Events should support endTime field"""
        event_data = {
            "type": "physicalPrep",
            "title": "TEST_EndTime_Feature",
            "date": "2026-03-01",
            "time": "14:00",
            "endTime": "15:30",  # Feature #3: End time
            "location": "Salle de gym"
        }
        
        response = api_client.post(f"{BASE_URL}/api/events", json=event_data)
        assert response.status_code == 200
        
        event = response.json()
        assert event.get("endTime") == "15:30", f"endTime should be '15:30', got {event.get('endTime')}"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/events/{event['id']}")
        
        print("✅ FEATURE #3: endTime field correctly stored")

    def test_api_health(self, api_client):
        """Basic health check"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
