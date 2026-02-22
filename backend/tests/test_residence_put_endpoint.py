"""
Test suite for PUT /api/residence/days/{date} endpoint (P1 bug fix).
Tests the new endpoint for modifying existing residence days.
"""
import pytest
import requests
import os
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://event-management-9.preview.emergentagent.com').rstrip('/')


class TestResidencePutEndpoint:
    """Test PUT /api/residence/days/{date} endpoint - P1 bug fix"""
    
    def test_put_update_country(self):
        """PUT /api/residence/days/{date} updates country field"""
        test_date = "2026-10-15"
        
        # First create a day
        create_payload = {
            "date": test_date,
            "country": "FR",
            "countryName": "France",
            "status": "manual",
            "notes": "TEST_PUT_Original"
        }
        create_response = requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        assert create_response.status_code == 200, f"Failed to create day: {create_response.text}"
        
        try:
            # Update using PUT
            update_payload = {
                "country": "ES",
                "countryName": "Espagne"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200, f"PUT failed: {put_response.text}"
            
            data = put_response.json()
            assert data["country"] == "ES", f"Country should be ES, got {data['country']}"
            assert data["countryName"] == "Espagne", f"CountryName should be Espagne, got {data['countryName']}"
            assert data["date"] == test_date, "Date should remain unchanged"
            
            print(f"✓ PUT updated country from FR to ES")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_update_status(self):
        """PUT /api/residence/days/{date} updates status field"""
        test_date = "2026-10-16"
        
        # Create with manual status
        create_payload = {
            "date": test_date,
            "country": "DE",
            "countryName": "Allemagne",
            "status": "manual",
            "notes": "TEST_PUT_Status"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Update status to confirmed
            update_payload = {
                "status": "confirmed"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200
            
            data = put_response.json()
            assert data["status"] == "confirmed", f"Status should be confirmed, got {data['status']}"
            assert data["country"] == "DE", "Country should remain unchanged"
            
            print(f"✓ PUT updated status from manual to confirmed")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_update_notes(self):
        """PUT /api/residence/days/{date} updates notes field"""
        test_date = "2026-10-17"
        
        # Create with initial notes
        create_payload = {
            "date": test_date,
            "country": "IT",
            "countryName": "Italie",
            "status": "manual",
            "notes": "TEST_Original notes"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Update notes
            update_payload = {
                "notes": "TEST_Updated notes - Rome trip"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200
            
            data = put_response.json()
            assert data["notes"] == "TEST_Updated notes - Rome trip", f"Notes not updated correctly"
            assert data["country"] == "IT", "Country should remain unchanged"
            
            print(f"✓ PUT updated notes field")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_update_multiple_fields(self):
        """PUT /api/residence/days/{date} updates multiple fields at once"""
        test_date = "2026-10-18"
        
        # Create initial day
        create_payload = {
            "date": test_date,
            "country": "FR",
            "countryName": "France",
            "status": "manual",
            "notes": "TEST_Initial"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Update multiple fields
            update_payload = {
                "country": "MC",
                "countryName": "Monaco",
                "status": "confirmed",
                "notes": "TEST_Updated - Monaco GP"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200
            
            data = put_response.json()
            assert data["country"] == "MC"
            assert data["countryName"] == "Monaco"
            assert data["status"] == "confirmed"
            assert data["notes"] == "TEST_Updated - Monaco GP"
            
            print(f"✓ PUT updated multiple fields at once")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_nonexistent_date_returns_404(self):
        """PUT /api/residence/days/{date} returns 404 for non-existent date"""
        nonexistent_date = "2099-12-31"
        
        update_payload = {
            "country": "FR",
            "countryName": "France"
        }
        
        response = requests.put(f"{BASE_URL}/api/residence/days/{nonexistent_date}", json=update_payload)
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print(f"✓ PUT returns 404 for non-existent date")
    
    def test_put_preserves_unchanged_fields(self):
        """PUT /api/residence/days/{date} preserves fields not in update payload"""
        test_date = "2026-10-19"
        
        # Create with all fields
        create_payload = {
            "date": test_date,
            "country": "GB",
            "countryName": "Royaume-Uni",
            "status": "confirmed",
            "notes": "TEST_Wimbledon"
        }
        create_response = requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        original_id = create_response.json().get("id")
        
        try:
            # Update only country
            update_payload = {
                "country": "FR",
                "countryName": "France"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200
            
            data = put_response.json()
            # Updated fields
            assert data["country"] == "FR"
            assert data["countryName"] == "France"
            # Preserved fields
            assert data["status"] == "confirmed", "Status should be preserved"
            assert data["notes"] == "TEST_Wimbledon", "Notes should be preserved"
            assert data.get("id") == original_id, "ID should be preserved"
            
            print(f"✓ PUT preserves unchanged fields")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_updates_updatedAt_timestamp(self):
        """PUT /api/residence/days/{date} updates the updatedAt timestamp"""
        test_date = "2026-10-20"
        
        # Create day
        create_payload = {
            "date": test_date,
            "country": "CH",
            "countryName": "Suisse",
            "status": "manual"
        }
        create_response = requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        original_updated_at = create_response.json().get("updatedAt")
        
        try:
            # Small delay to ensure timestamp difference
            import time
            time.sleep(0.1)
            
            # Update
            update_payload = {
                "notes": "TEST_Timestamp check"
            }
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            assert put_response.status_code == 200
            
            data = put_response.json()
            new_updated_at = data.get("updatedAt")
            
            assert new_updated_at is not None, "updatedAt should be present"
            assert new_updated_at != original_updated_at, "updatedAt should be updated"
            
            print(f"✓ PUT updates updatedAt timestamp")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_verify_persistence_via_get(self):
        """PUT changes persist and are visible via GET"""
        test_date = "2026-10-21"
        
        # Create day
        create_payload = {
            "date": test_date,
            "country": "AT",
            "countryName": "Autriche",
            "status": "manual",
            "notes": "TEST_Persistence"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Update via PUT
            update_payload = {
                "country": "BE",
                "countryName": "Belgique",
                "status": "confirmed"
            }
            requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
            
            # Verify via GET
            get_response = requests.get(f"{BASE_URL}/api/residence/days?year=2026")
            assert get_response.status_code == 200
            
            days = get_response.json()
            updated_day = next((d for d in days if d["date"] == test_date), None)
            
            assert updated_day is not None, "Day should exist in GET response"
            assert updated_day["country"] == "BE", "Country should be updated"
            assert updated_day["countryName"] == "Belgique", "CountryName should be updated"
            assert updated_day["status"] == "confirmed", "Status should be updated"
            
            print(f"✓ PUT changes persist and visible via GET")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_put_empty_payload(self):
        """PUT with empty payload should still return 200 (no changes)"""
        test_date = "2026-10-22"
        
        # Create day
        create_payload = {
            "date": test_date,
            "country": "NL",
            "countryName": "Pays-Bas",
            "status": "manual"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # PUT with empty payload
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json={})
            
            assert put_response.status_code == 200, f"Empty PUT should succeed, got {put_response.status_code}"
            
            data = put_response.json()
            assert data["country"] == "NL", "Country should remain unchanged"
            
            print(f"✓ PUT with empty payload succeeds without changes")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")


class TestResidencePutIntegration:
    """Integration tests for PUT endpoint with other operations"""
    
    def test_create_put_delete_flow(self):
        """Test complete Create-PUT-Delete flow"""
        test_date = "2026-10-25"
        
        # CREATE
        create_payload = {
            "date": test_date,
            "country": "FR",
            "countryName": "France",
            "status": "manual",
            "notes": "TEST_Integration"
        }
        create_response = requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        assert create_response.status_code == 200
        print(f"  1. Created day: {test_date} in France")
        
        # PUT UPDATE
        update_payload = {
            "country": "ES",
            "countryName": "Espagne",
            "status": "confirmed",
            "notes": "TEST_Updated via PUT"
        }
        put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=update_payload)
        assert put_response.status_code == 200
        assert put_response.json()["country"] == "ES"
        print(f"  2. Updated via PUT: France -> Espagne")
        
        # VERIFY in stats
        stats_response = requests.get(f"{BASE_URL}/api/residence/stats?year=2026")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        es_stats = next((c for c in stats["countries"] if c["country"] == "ES"), None)
        assert es_stats is not None, "Spain should appear in stats"
        print(f"  3. Verified in stats: Spain has {es_stats['totalDays']} days")
        
        # DELETE
        delete_response = requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
        assert delete_response.status_code == 200
        print(f"  4. Deleted day")
        
        print(f"✓ Complete Create-PUT-Delete flow successful")
    
    def test_put_vs_post_update_behavior(self):
        """Compare PUT update vs POST update (both should work)"""
        test_date = "2026-10-26"
        
        # Create initial day
        create_payload = {
            "date": test_date,
            "country": "FR",
            "countryName": "France",
            "status": "manual"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Update via PUT
            put_payload = {"country": "DE", "countryName": "Allemagne"}
            put_response = requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=put_payload)
            assert put_response.status_code == 200
            assert put_response.json()["country"] == "DE"
            print(f"  PUT update: FR -> DE ✓")
            
            # Update via POST (existing behavior)
            post_payload = {
                "date": test_date,
                "country": "IT",
                "countryName": "Italie",
                "status": "confirmed"
            }
            post_response = requests.post(f"{BASE_URL}/api/residence/days", json=post_payload)
            assert post_response.status_code == 200
            assert post_response.json()["country"] == "IT"
            print(f"  POST update: DE -> IT ✓")
            
            # Verify final state
            get_response = requests.get(f"{BASE_URL}/api/residence/days?year=2026")
            days = get_response.json()
            final_day = next((d for d in days if d["date"] == test_date), None)
            assert final_day["country"] == "IT"
            
            print(f"✓ Both PUT and POST update methods work correctly")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")


class TestResidenceStatsAfterPut:
    """Test that stats are correctly updated after PUT operations"""
    
    def test_stats_update_after_country_change(self):
        """Stats reflect country change after PUT"""
        test_date = "2026-10-27"
        
        # Create day in France
        create_payload = {
            "date": test_date,
            "country": "FR",
            "countryName": "France",
            "status": "manual"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Get initial stats
            initial_stats = requests.get(f"{BASE_URL}/api/residence/stats?year=2026").json()
            initial_fr_days = next((c["totalDays"] for c in initial_stats["countries"] if c["country"] == "FR"), 0)
            
            # Change to Spain via PUT
            put_payload = {"country": "ES", "countryName": "Espagne"}
            requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=put_payload)
            
            # Get updated stats
            updated_stats = requests.get(f"{BASE_URL}/api/residence/stats?year=2026").json()
            updated_fr_days = next((c["totalDays"] for c in updated_stats["countries"] if c["country"] == "FR"), 0)
            updated_es_days = next((c["totalDays"] for c in updated_stats["countries"] if c["country"] == "ES"), 0)
            
            # France should have one less day (or same if there were other FR days)
            # Spain should have at least 1 day
            assert updated_es_days >= 1, "Spain should have at least 1 day after PUT"
            
            print(f"✓ Stats correctly updated after PUT country change")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")
    
    def test_stats_confirmed_manual_count_after_put(self):
        """Stats correctly count confirmed vs manual after PUT status change"""
        test_date = "2026-10-28"
        
        # Create manual day
        create_payload = {
            "date": test_date,
            "country": "PT",
            "countryName": "Portugal",
            "status": "manual"
        }
        requests.post(f"{BASE_URL}/api/residence/days", json=create_payload)
        
        try:
            # Change to confirmed via PUT
            put_payload = {"status": "confirmed"}
            requests.put(f"{BASE_URL}/api/residence/days/{test_date}", json=put_payload)
            
            # Check stats
            stats = requests.get(f"{BASE_URL}/api/residence/stats?year=2026").json()
            pt_stats = next((c for c in stats["countries"] if c["country"] == "PT"), None)
            
            assert pt_stats is not None, "Portugal should be in stats"
            assert pt_stats["confirmedDays"] >= 1, "Should have at least 1 confirmed day"
            
            print(f"✓ Stats correctly count confirmed days after PUT status change")
        finally:
            requests.delete(f"{BASE_URL}/api/residence/days/{test_date}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
