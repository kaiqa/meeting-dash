"""Pytest configuration and fixtures."""
import asyncio
import os
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from faker import Faker
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

from app.config import Settings, get_settings
from app.database import Base, get_async_db
from app.main import app
from app.models.meeting import Meeting
from app.models.setting import Setting
from app.schemas.meeting import MeetingCreate
from app.services.websocket import WebSocketManager

fake = Faker()


# Override settings for testing
class TestSettings(Settings):
    app_env: str = "test"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./test.db"
    webhook_host: str = "0.0.0.0"
    webhook_port: int = 5687
    webhook_path: str = "/webhook/req-meeting"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def test_settings() -> TestSettings:
    """Test settings instance."""
    return TestSettings()


@pytest.fixture(scope="function")
def sync_engine():
    """Create synchronous test engine with SQLite."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    # Enable foreign keys for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(scope="function")
def sync_session(sync_engine) -> Generator[Session, None, None]:
    """Create synchronous test session."""
    SessionLocal = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(scope="function")
async def async_engine():
    """Create asynchronous test engine with SQLite."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create asynchronous test session."""
    AsyncSessionLocal = async_sessionmaker(
        bind=async_engine,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


@pytest.fixture(scope="function")
def override_get_db(sync_session):
    """Override database dependency for sync tests."""
    def _get_db():
        try:
            yield sync_session
        finally:
            pass

    app.dependency_overrides[get_async_db] = _get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def override_get_async_db(async_session):
    """Override database dependency for async tests."""
    async def _get_db():
        yield async_session

    app.dependency_overrides[get_async_db] = _get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(override_get_db) -> TestClient:
    """Create test client."""
    return TestClient(app)


@pytest.fixture(scope="function")
async def async_client(override_get_async_db) -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture(scope="function")
def websocket_manager() -> WebSocketManager:
    """Create WebSocket manager instance."""
    return WebSocketManager()


@pytest.fixture(scope="function")
def sample_meeting_data() -> dict[str, Any]:
    """Generate sample meeting data."""
    return {
        "user_name": fake.name(),
        "user_email": fake.email(),
        "meeting_time": fake.future_datetime(end_date="+30d"),
        "company_name": fake.company(),
        "job_opportunity": fake.job(),
        "recruiter_name": fake.name(),
    }


@pytest.fixture(scope="function")
async def sample_meeting(async_session, sample_meeting_data) -> Meeting:
    """Create a sample meeting in the database."""
    meeting = Meeting(**sample_meeting_data, is_active=True)
    async_session.add(meeting)
    await async_session.commit()
    await async_session.refresh(meeting)
    return meeting


@pytest.fixture(scope="function")
async def multiple_meetings(async_session) -> list[Meeting]:
    """Create multiple sample meetings."""
    meetings = []
    for i in range(5):
        data = {
            "user_name": fake.name(),
            "user_email": fake.email(),
            "meeting_time": fake.future_datetime(end_date="+30d"),
            "company_name": fake.company() if i % 2 == 0 else None,
            "job_opportunity": fake.job() if i % 3 == 0 else None,
            "recruiter_name": fake.name() if i % 2 == 0 else None,
            "is_active": i % 2 == 0,
        }
        meeting = Meeting(**data)
        async_session.add(meeting)
        meetings.append(meeting)
    await async_session.commit()
    for m in meetings:
        await async_session.refresh(m)
    return meetings


@pytest.fixture(scope="function")
async def sample_settings(async_session) -> list[Setting]:
    """Create sample settings."""
    settings_data = [
        {"key": "webhook_host", "value": "0.0.0.0", "description": "IP address to bind webhook server"},
        {"key": "webhook_port", "value": "5687", "description": "Port for webhook server"},
        {"key": "webhook_path", "value": "/webhook/req-meeting", "description": "Webhook endpoint path"},
    ]
    settings = [Setting(**data) for data in settings_data]
    async_session.add_all(settings)
    await async_session.commit()
    for s in settings:
        await async_session.refresh(s)
    return settings


@pytest.fixture(scope="function")
def mock_websocket() -> AsyncMock:
    """Create mock WebSocket for testing."""
    ws = AsyncMock()
    ws.accept = AsyncMock()
    ws.send_text = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.close = AsyncMock()
    return ws


# Custom pytest markers
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests")
    config.addinivalue_line("markers", "integration: Integration tests")
    config.addinivalue_line("markers", "webhook: Webhook endpoint tests")
    config.addinivalue_line("markers", "api: API endpoint tests")
    config.addinivalue_line("markers", "websocket: WebSocket tests")
    config.addinivalue_line("markers", "slow: Slow tests")