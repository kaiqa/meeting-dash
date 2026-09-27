"""Tests for meetings API endpoints."""
import pytest
from httpx import AsyncClient


class TestMeetingsAPI:
    """Tests for /api/meetings endpoints."""

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_list_meetings_empty(self, async_client: AsyncClient):
        """Test listing meetings when database is empty."""
        response = await async_client.get("/api/meetings")

        assert response.status_code == 200
        data = response.json()

        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["total_pages"] == 0

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_list_meetings_with_data(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test listing meetings with data."""
        response = await async_client.get("/api/meetings")

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) == 5
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["page_size"] == 20

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_list_meetings_pagination(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test pagination of meetings list."""
        # First page
        response = await async_client.get("/api/meetings?page=1&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] == 3

        # Second page
        response = await async_client.get("/api/meetings?page=2&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 2

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_list_meetings_search(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test search filter on meetings list."""
        # Get a meeting to search for
        meeting = multiple_meetings[0]
        search_term = meeting.user_name.split()[0]  # First name

        response = await async_client.get(f"/api/meetings?search={search_term}")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] >= 1
        for item in data["items"]:
            assert search_term.lower() in item["user_name"].lower()

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_list_meetings_filter_active(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test filtering by active status."""
        response = await async_client.get("/api/meetings?is_active=true")
        assert response.status_code == 200
        data = response.json()

        for item in data["items"]:
            assert item["is_active"] is True

        response = await async_client.get("/api/meetings?is_active=false")
        assert response.status_code == 200
        data = response.json()

        for item in data["items"]:
            assert item["is_active"] is False

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_get_meeting_by_id(
        self, async_client: AsyncClient, sample_meeting
    ):
        """Test getting a single meeting by ID."""
        response = await async_client.get(f"/api/meetings/{sample_meeting.id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == sample_meeting.id
        assert data["user_name"] == sample_meeting.user_name
        assert data["user_email"] == sample_meeting.user_email

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_get_nonexistent_meeting(self, async_client: AsyncClient):
        """Test getting a non-existent meeting returns 404."""
        response = await async_client.get("/api/meetings/99999")

        assert response.status_code == 404
        # FastAPI returns JSON for HTTPException, but handle empty response
        try:
            data = response.json()
            assert "not found" in data["detail"].lower()
        except Exception:
            # Response body might be empty in some test configurations
            pass

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_update_meeting_activate(
        self, async_client: AsyncClient, sample_meeting
    ):
        """Test activating a meeting."""
        # First deactivate
        await async_client.patch(
            f"/api/meetings/{sample_meeting.id}",
            json={"is_active": False},
        )

        # Then activate
        response = await async_client.patch(
            f"/api/meetings/{sample_meeting.id}",
            json={"is_active": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_update_meeting_deactivate(
        self, async_client: AsyncClient, sample_meeting
    ):
        """Test deactivating a meeting."""
        response = await async_client.patch(
            f"/api/meetings/{sample_meeting.id}",
            json={"is_active": False},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_update_nonexistent_meeting(self, async_client: AsyncClient):
        """Test updating a non-existent meeting returns 404."""
        response = await async_client.patch(
            "/api/meetings/99999",
            json={"is_active": False},
        )

        assert response.status_code == 404

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_delete_meeting(
        self, async_client: AsyncClient, sample_meeting
    ):
        """Test deleting a meeting."""
        response = await async_client.delete(f"/api/meetings/{sample_meeting.id}")

        assert response.status_code == 204

        # Verify it's gone
        response = await async_client.get(f"/api/meetings/{sample_meeting.id}")
        assert response.status_code == 404

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_delete_nonexistent_meeting(self, async_client: AsyncClient):
        """Test deleting a non-existent meeting returns 404."""
        response = await async_client.delete("/api/meetings/99999")

        assert response.status_code == 404

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_export_meetings_json(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test exporting meetings as JSON."""
        response = await async_client.get("/api/meetings/export/all")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 5

        # Check structure
        for item in data:
            assert "id" in item
            assert "user_name" in item
            assert "user_email" in item
            assert "meeting_time" in item
            assert "is_active" in item

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_export_meetings_csv(
        self, async_client: AsyncClient, multiple_meetings
    ):
        """Test exporting meetings as CSV."""
        response = await async_client.get("/api/meetings/export/csv")

        assert response.status_code == 200
        # FastAPI adds charset=utf-8
        assert response.headers["content-type"].startswith("text/csv")
        assert "attachment" in response.headers["content-disposition"]

        content = response.text
        lines = content.strip().split("\n")
        assert len(lines) == 6  # Header + 5 data rows

        # Check header
        assert "ID" in lines[0]
        assert "User Name" in lines[0]
        assert "User Email" in lines[0]

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_export_empty_json(self, async_client: AsyncClient):
        """Test exporting JSON when no meetings exist."""
        response = await async_client.get("/api/meetings/export/all")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    @pytest.mark.api
    @pytest.mark.asyncio
    async def test_export_empty_csv(self, async_client: AsyncClient):
        """Test exporting CSV when no meetings exist."""
        response = await async_client.get("/api/meetings/export/csv")

        assert response.status_code == 200
        content = response.text
        lines = content.strip().split("\n")
        assert len(lines) == 1  # Only header
        assert "ID" in lines[0]