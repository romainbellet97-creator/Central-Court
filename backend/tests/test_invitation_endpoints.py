"""
Test suite for Staff Invitation System endpoints
Tests: create invitation, get by token, mark viewed, signup, list invitations, list staff, resend, cancel, remove staff
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Base URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://event-management-9.preview.emergentagent.com').rstrip('/')

# Test data
TEST_PLAYER_ID = "698aa79d59d2bf64a89327fb"
TEST_EMAIL_PREFIX = "TEST_staff_"
TEST_TIMESTAMP = int(time.time())


class TestInvitationCreate:
    """Test POST /api/invitations/create endpoint"""
    
    def test_create_invitation_success(self):
        """Create a new staff invitation"""
        test_email = f"{TEST_EMAIL_PREFIX}coach_{TEST_TIMESTAMP}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "inviteeName": "Test Coach",
            "role": "tennis_coach",
            "roleCustom": None
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "token" in data, "Response should contain 'token'"
        assert data["playerId"] == TEST_PLAYER_ID
        assert data["inviteeEmail"] == test_email
        assert data["role"] == "tennis_coach"
        assert data["status"] == "pending"
        assert len(data["token"]) == 32, "Token should be 32 characters"
        
        # Store for later tests
        TestInvitationCreate.created_invitation_id = data["id"]
        TestInvitationCreate.created_token = data["token"]
        TestInvitationCreate.created_email = test_email
        
        print(f"✓ Created invitation: {data['id']} with token: {data['token'][:8]}...")
    
    def test_create_invitation_duplicate_returns_existing(self):
        """Creating duplicate invitation should return existing one"""
        test_email = f"{TEST_EMAIL_PREFIX}coach_{TEST_TIMESTAMP}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "inviteeName": "Test Coach",
            "role": "tennis_coach"
        })
        
        assert response.status_code == 200
        data = response.json()
        # Should return the same invitation
        assert data["id"] == TestInvitationCreate.created_invitation_id
        print("✓ Duplicate invitation returns existing one")
    
    def test_create_invitation_different_roles(self):
        """Create invitations with different roles"""
        roles = ["physical_coach", "physio", "agent", "family", "other"]
        
        for role in roles:
            test_email = f"{TEST_EMAIL_PREFIX}{role}_{TEST_TIMESTAMP}@test.com"
            response = requests.post(f"{BASE_URL}/api/invitations/create", json={
                "playerId": TEST_PLAYER_ID,
                "inviteeEmail": test_email,
                "inviteeName": f"Test {role}",
                "role": role
            })
            
            assert response.status_code == 200, f"Failed for role {role}: {response.text}"
            data = response.json()
            assert data["role"] == role
            print(f"✓ Created invitation for role: {role}")
    
    def test_create_invitation_invalid_email(self):
        """Invalid email should fail validation"""
        response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": "invalid-email",
            "role": "tennis_coach"
        })
        
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print("✓ Invalid email rejected with 422")


class TestInvitationGetByToken:
    """Test GET /api/invitations/token/{token} endpoint"""
    
    def test_get_invitation_by_token_success(self):
        """Get invitation details by valid token"""
        token = TestInvitationCreate.created_token
        
        response = requests.get(f"{BASE_URL}/api/invitations/token/{token}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["token"] == token
        assert data["playerId"] == TEST_PLAYER_ID
        assert data["status"] == "pending"
        assert "playerName" in data
        assert "expiresAt" in data
        print(f"✓ Retrieved invitation by token: {data['id']}")
    
    def test_get_invitation_invalid_token(self):
        """Invalid token should return 404"""
        response = requests.get(f"{BASE_URL}/api/invitations/token/invalid_token_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid token returns 404")


class TestInvitationMarkViewed:
    """Test POST /api/invitations/token/{token}/view endpoint"""
    
    def test_mark_invitation_viewed(self):
        """Mark invitation as viewed"""
        token = TestInvitationCreate.created_token
        
        response = requests.post(f"{BASE_URL}/api/invitations/token/{token}/view")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Marked invitation as viewed, updated: {data.get('updated')}")
    
    def test_mark_viewed_already_viewed(self):
        """Marking already viewed invitation should succeed but not update"""
        token = TestInvitationCreate.created_token
        
        response = requests.post(f"{BASE_URL}/api/invitations/token/{token}/view")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["updated"] == False  # Already viewed
        print("✓ Already viewed invitation returns updated=False")
    
    def test_verify_viewed_at_set(self):
        """Verify viewedAt is set after marking viewed"""
        token = TestInvitationCreate.created_token
        
        response = requests.get(f"{BASE_URL}/api/invitations/token/{token}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["viewedAt"] is not None, "viewedAt should be set"
        print(f"✓ viewedAt is set: {data['viewedAt']}")


class TestInvitationPlayerList:
    """Test GET /api/invitations/player/{player_id} endpoint"""
    
    def test_get_player_invitations(self):
        """Get all invitations for a player"""
        response = requests.get(f"{BASE_URL}/api/invitations/player/{TEST_PLAYER_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invitations" in data
        assert isinstance(data["invitations"], list)
        assert len(data["invitations"]) > 0, "Should have at least one invitation"
        
        # Verify structure of first invitation
        inv = data["invitations"][0]
        assert "id" in inv
        assert "token" in inv
        assert "playerId" in inv
        assert "status" in inv
        
        print(f"✓ Retrieved {len(data['invitations'])} invitations for player")


class TestInvitationResend:
    """Test POST /api/invitations/{id}/resend endpoint"""
    
    def test_resend_invitation(self):
        """Resend an invitation (extends expiry)"""
        invitation_id = TestInvitationCreate.created_invitation_id
        
        response = requests.post(f"{BASE_URL}/api/invitations/{invitation_id}/resend")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "message" in data
        print(f"✓ Resent invitation: {data['message']}")
    
    def test_verify_reminder_count_incremented(self):
        """Verify reminderCount is incremented after resend"""
        token = TestInvitationCreate.created_token
        
        response = requests.get(f"{BASE_URL}/api/invitations/token/{token}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["reminderCount"] >= 1, "reminderCount should be at least 1"
        print(f"✓ reminderCount is {data['reminderCount']}")
    
    def test_resend_invalid_id(self):
        """Resend with invalid ID should return 400 or 404"""
        response = requests.post(f"{BASE_URL}/api/invitations/invalid_id/resend")
        
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print("✓ Invalid ID returns error")


class TestInvitationCancel:
    """Test POST /api/invitations/{id}/cancel endpoint"""
    
    def test_cancel_invitation(self):
        """Cancel a pending invitation"""
        # Create a new invitation to cancel
        test_email = f"{TEST_EMAIL_PREFIX}cancel_{TEST_TIMESTAMP}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "inviteeName": "To Cancel",
            "role": "other"
        })
        
        assert create_response.status_code == 200
        invitation_id = create_response.json()["id"]
        
        # Cancel it
        response = requests.post(f"{BASE_URL}/api/invitations/{invitation_id}/cancel")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Cancelled invitation: {data['message']}")
        
        TestInvitationCancel.cancelled_id = invitation_id
    
    def test_verify_cancelled_status(self):
        """Verify invitation status is cancelled"""
        response = requests.get(f"{BASE_URL}/api/invitations/player/{TEST_PLAYER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        cancelled_inv = next((inv for inv in data["invitations"] if inv["id"] == TestInvitationCancel.cancelled_id), None)
        assert cancelled_inv is not None
        assert cancelled_inv["status"] == "cancelled"
        print("✓ Invitation status is 'cancelled'")
    
    def test_cancel_already_cancelled(self):
        """Cancelling already cancelled invitation should fail"""
        response = requests.post(f"{BASE_URL}/api/invitations/{TestInvitationCancel.cancelled_id}/cancel")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Already cancelled invitation returns 404")


class TestStaffSignup:
    """Test POST /api/invitations/signup endpoint"""
    
    def test_signup_with_valid_token(self):
        """Sign up as staff member with valid invitation token"""
        # Create a fresh invitation for signup
        test_email = f"{TEST_EMAIL_PREFIX}signup_{TEST_TIMESTAMP}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "inviteeName": "New Staff",
            "role": "physio"
        })
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        
        # Sign up
        response = requests.post(f"{BASE_URL}/api/invitations/signup", json={
            "invitationToken": token,
            "firstName": "Test",
            "lastName": "Staff",
            "phone": "+33612345678",
            "password": "SecurePassword123!"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        assert "staff" in data
        assert "authToken" in data
        
        staff = data["staff"]
        assert staff["email"] == test_email
        assert staff["firstName"] == "Test"
        assert staff["lastName"] == "Staff"
        assert staff["role"] == "physio"
        assert staff["status"] == "active"
        assert "permissions" in staff
        
        print(f"✓ Staff signup successful: {staff['id']}")
        
        TestStaffSignup.created_staff_id = staff["id"]
        TestStaffSignup.signup_token = token
    
    def test_signup_invalid_token(self):
        """Signup with invalid token should fail"""
        response = requests.post(f"{BASE_URL}/api/invitations/signup", json={
            "invitationToken": "invalid_token_12345",
            "firstName": "Test",
            "password": "Password123!"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid token returns 400")
    
    def test_signup_already_used_token(self):
        """Signup with already used token should fail"""
        response = requests.post(f"{BASE_URL}/api/invitations/signup", json={
            "invitationToken": TestStaffSignup.signup_token,
            "firstName": "Another",
            "password": "Password123!"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Already used token returns 400")
    
    def test_verify_invitation_accepted(self):
        """Verify invitation status is accepted after signup"""
        response = requests.get(f"{BASE_URL}/api/invitations/player/{TEST_PLAYER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Find the invitation that was used for signup
        accepted_inv = next((inv for inv in data["invitations"] 
                           if inv["token"] == TestStaffSignup.signup_token), None)
        
        assert accepted_inv is not None
        assert accepted_inv["status"] == "accepted"
        assert accepted_inv["acceptedAt"] is not None
        print("✓ Invitation status is 'accepted'")


class TestStaffList:
    """Test GET /api/invitations/staff/player/{player_id} endpoint"""
    
    def test_get_player_staff(self):
        """Get all active staff members for a player"""
        response = requests.get(f"{BASE_URL}/api/invitations/staff/player/{TEST_PLAYER_ID}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "staff" in data
        assert isinstance(data["staff"], list)
        
        if len(data["staff"]) > 0:
            staff = data["staff"][0]
            assert "id" in staff
            assert "email" in staff
            assert "firstName" in staff
            assert "role" in staff
            assert "permissions" in staff
            assert "status" in staff
        
        print(f"✓ Retrieved {len(data['staff'])} staff members for player")


class TestStaffRemove:
    """Test DELETE /api/invitations/staff/{staff_id} endpoint"""
    
    def test_remove_staff_member(self):
        """Remove a staff member (soft delete)"""
        staff_id = TestStaffSignup.created_staff_id
        
        response = requests.delete(f"{BASE_URL}/api/invitations/staff/{staff_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["success"] == True
        print(f"✓ Removed staff member: {data['message']}")
    
    def test_verify_staff_removed(self):
        """Verify staff member is no longer in active list"""
        response = requests.get(f"{BASE_URL}/api/invitations/staff/player/{TEST_PLAYER_ID}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Staff should not be in the list (status != 'removed')
        removed_staff = next((s for s in data["staff"] 
                             if s["id"] == TestStaffSignup.created_staff_id), None)
        
        assert removed_staff is None, "Removed staff should not appear in active list"
        print("✓ Removed staff not in active list")
    
    def test_remove_invalid_id(self):
        """Remove with invalid ID should return error"""
        response = requests.delete(f"{BASE_URL}/api/invitations/staff/invalid_id")
        
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
        print("✓ Invalid staff ID returns error")


class TestInvitationPermissions:
    """Test role-based permissions in staff signup"""
    
    def test_tennis_coach_permissions(self):
        """Verify tennis coach gets correct default permissions"""
        test_email = f"{TEST_EMAIL_PREFIX}coach_perm_{TEST_TIMESTAMP}@test.com"
        
        # Create invitation
        create_response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "role": "tennis_coach"
        })
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        
        # Signup
        signup_response = requests.post(f"{BASE_URL}/api/invitations/signup", json={
            "invitationToken": token,
            "firstName": "Coach",
            "password": "Password123!"
        })
        
        assert signup_response.status_code == 200
        staff = signup_response.json()["staff"]
        
        permissions = staff["permissions"]
        assert permissions["canViewCalendar"] == True
        assert permissions["canEditCalendar"] == True
        assert permissions["canViewDocuments"] == True
        assert permissions["canUploadDocuments"] == True
        assert permissions["canViewFinances"] == False
        assert permissions["canManageInvoices"] == False
        
        print("✓ Tennis coach has correct permissions")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invitations/staff/{staff['id']}")
    
    def test_agent_permissions(self):
        """Verify agent gets full permissions"""
        test_email = f"{TEST_EMAIL_PREFIX}agent_perm_{TEST_TIMESTAMP}@test.com"
        
        # Create invitation
        create_response = requests.post(f"{BASE_URL}/api/invitations/create", json={
            "playerId": TEST_PLAYER_ID,
            "inviteeEmail": test_email,
            "role": "agent"
        })
        
        assert create_response.status_code == 200
        token = create_response.json()["token"]
        
        # Signup
        signup_response = requests.post(f"{BASE_URL}/api/invitations/signup", json={
            "invitationToken": token,
            "firstName": "Agent",
            "password": "Password123!"
        })
        
        assert signup_response.status_code == 200
        staff = signup_response.json()["staff"]
        
        permissions = staff["permissions"]
        assert permissions["canViewCalendar"] == True
        assert permissions["canEditCalendar"] == True
        assert permissions["canViewDocuments"] == True
        assert permissions["canUploadDocuments"] == True
        assert permissions["canViewFinances"] == True
        assert permissions["canManageInvoices"] == True
        
        print("✓ Agent has full permissions")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/invitations/staff/{staff['id']}")


# Run tests in order
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
