"""Tests for webhook endpoint."""
import pytest
from httpx import AsyncClient
from datetime import datetime


def meeting_data_to_json(data: dict) -> dict:
    """Convert meeting data dict to JSON-serializable format."""
    result = data.copy()
    if "meeting_time" in result and isinstance(result["meeting_time"], datetime):
        result["meeting_time"] = result["meeting_time"].isoformat() + "Z"
    return result


def dograh_data_to_json(data: dict) -> dict:
    """Convert Dograh format data to JSON-serializable format."""
    result = data.copy()
    if "meeting_date" in result and isinstance(result["meeting_date"], datetime):
        result["meeting_date"] = result["meeting_date"].isoformat() + "Z"
    return result


class TestWebhookEndpoint:
    """Tests for POST /webhook/req-meeting endpoint."""

    # --- Legacy/n8n Format Tests ---

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_receive_valid_legacy_meeting_request(self, async_client: AsyncClient, sample_meeting_data):
        """Test receiving a valid meeting request in legacy/n8n format."""
        response = await async_client.post(
            "/webhook/req-meeting",
            json=meeting_data_to_json(sample_meeting_data),
        )

        assert response.status_code == 201
        data = response.json()

        assert data["user_name"] == sample_meeting_data["user_name"]
        assert data["user_email"] == sample_meeting_data["user_email"]
        assert data["company_name"] == sample_meeting_data["company_name"]
        assert data["job_opportunity"] == sample_meeting_data["job_opportunity"]
        assert data["recruiter_name"] == sample_meeting_data["recruiter_name"]
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_receive_minimal_legacy_meeting_request(self, async_client: AsyncClient):
        """Test receiving a minimal meeting request in legacy format."""
        minimal_data = {
            "user_name": "John Doe",
            "user_email": "john@example.com",
            "meeting_time": "2026-10-15T14:00:00Z",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=minimal_data,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["user_name"] == "John Doe"
        assert data["user_email"] == "john@example.com"
        assert data["company_name"] is None
        assert data["job_opportunity"] is None
        assert data["recruiter_name"] is None

    # --- Dograh AI Format Tests ---

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_receive_valid_dograh_meeting_request(self, async_client: AsyncClient):
        """Test receiving a valid meeting request in Dograh AI format."""
        dograh_data = {
            "recruiter_name": "Jane Smith",
            "contact_email": "jane@dograh.ai",
            "meeting_date": "2026-10-15T14:00:00Z",
            "company_name": "Acme Corp",
            "job_opportunity": "Senior Engineer",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=dograh_data,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["user_name"] == "Jane Smith"
        assert data["user_email"] == "jane@dograh.ai"
        assert data["meeting_time"] == "2026-10-15T14:00:00"
        assert data["company_name"] == "Acme Corp"
        assert data["job_opportunity"] == "Senior Engineer"
        assert data["recruiter_name"] == "Jane Smith"
        assert data["is_active"] is True
        assert "id" in data

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_receive_minimal_dograh_meeting_request(self, async_client: AsyncClient):
        """Test receiving a minimal Dograh meeting request."""
        minimal_data = {
            "recruiter_name": "John Doe",
            "contact_email": "john@example.com",
            "meeting_date": "2026-10-15T14:00:00Z",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=minimal_data,
        )

        assert response.status_code == 201
        data = response.json()

        assert data["user_name"] == "John Doe"
        assert data["user_email"] == "john@example.com"
        assert data["company_name"] is None
        assert data["job_opportunity"] is None
        assert data["recruiter_name"] == "John Doe"

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_receive_dograh_with_job_opportunity(self, async_client: AsyncClient):
        """Test Dograh format correctly stores job_opportunity."""
        dograh_data = {
            "recruiter_name": "Recruiter Name",
            "contact_email": "recruiter@test.com",
            "meeting_date": "2026-10-20T10:00:00Z",
            "company_name": "Test Company",
            "job_opportunity": "Software Developer Position",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=dograh_data,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["job_opportunity"] == "Software Developer Position"

    # --- Validation Tests (both formats) ---

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_invalid_email_legacy(self, async_client: AsyncClient, sample_meeting_data):
        """Test rejecting legacy request with invalid email."""
        data = meeting_data_to_json(sample_meeting_data)
        data["user_email"] = "not-an-email"

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_invalid_email_dograh(self, async_client: AsyncClient):
        """Test rejecting Dograh request with invalid email."""
        data = {
            "recruiter_name": "John Doe",
            "contact_email": "not-an-email",
            "meeting_date": "2026-10-15T14:00:00Z",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_missing_required_fields(self, async_client: AsyncClient):
        """Test rejecting request with missing required fields."""
        incomplete_data = {
            "user_name": "John Doe",
            # Missing user_email and meeting_time
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=incomplete_data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_missing_required_fields_dograh(self, async_client: AsyncClient):
        """Test rejecting Dograh request with missing required fields."""
        incomplete_data = {
            "recruiter_name": "John Doe",
            # Missing contact_email and meeting_date
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=incomplete_data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_invalid_meeting_time_legacy(self, async_client: AsyncClient, sample_meeting_data):
        """Test rejecting legacy request with invalid meeting time format."""
        data = meeting_data_to_json(sample_meeting_data)
        data["meeting_time"] = "not-a-date"

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_invalid_meeting_date_dograh(self, async_client: AsyncClient):
        """Test rejecting Dograh request with invalid meeting date format."""
        data = {
            "recruiter_name": "John Doe",
            "contact_email": "john@example.com",
            "meeting_date": "not-a-date",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_empty_user_name(self, async_client: AsyncClient, sample_meeting_data):
        """Test rejecting request with empty user name."""
        data = meeting_data_to_json(sample_meeting_data)
        data["user_name"] = ""
        data["recruiter_name"] = ""  # Also empty fallback

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_reject_empty_recruiter_name_dograh(self, async_client: AsyncClient):
        """Test rejecting Dograh request with empty recruiter name."""
        data = {
            "recruiter_name": "",
            "contact_email": "john@example.com",
            "meeting_date": "2026-10-15T14:00:00Z",
        }

        response = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )

        assert response.status_code == 422

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_webhook_health_check(self, async_client: AsyncClient):
        """Test webhook health check endpoint."""
        response = await async_client.get("/webhook/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "webhook"

    @pytest.mark.webhook
    @pytest.mark.asyncio
    async def test_multiple_requests_create_separate_records(
        self, async_client: AsyncClient, sample_meeting_data
    ):
        """Test that multiple requests create separate records."""
        # First request
        response1 = await async_client.post(
            "/webhook/req-meeting",
            json=meeting_data_to_json(sample_meeting_data),
        )
        assert response1.status_code == 201
        id1 = response1.json()["id"]

        # Second request with different email
        data = meeting_data_to_json(sample_meeting_data)
        data["user_email"] = "jane@example.com"
        response2 = await async_client.post(
            "/webhook/req-meeting",
            json=data,
        )
        assert response2.status_code == 201
        id2 = response2.json()["id"]

        assert id1 != id2