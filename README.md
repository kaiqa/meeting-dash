# Meeting Request Dashboard

A modern, production-ready dashboard for managing meeting requests received via webhook. Built with FastAPI, MySQL, and vanilla JavaScript.

## Features

- 🔄 **Real-time Updates** - WebSocket-powered live dashboard updates when new meetings arrive
- 📊 **Modern Dashboard** - Clean, responsive UI with statistics, search, filtering, and pagination
- ⚙️ **Configurable Webhook** - Settings page to configure listen IP, port, and path (e.g., `100.66.60.70:5687` or `100.122.130.97:5687`)
- 📥 **Export Data** - Download meetings as JSON or CSV
- 🗄️ **MySQL Backend** - Reliable data persistence with proper indexing
- 🐳 **Docker Ready** - Production-ready Docker Compose deployment
- 🧪 **Comprehensive Tests** - Pytest suite with unit and integration tests
- 🌙 **Dark/Light Theme** - Automatic theme detection with manual toggle support
- ⏱️ **Meeting Duration Support** - Configurable meeting duration with overlap detection (5-480 minutes)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Webhook Sender │────▶│  Webhook Endpoint │────▶│   MySQL     │
│   (External)    │     │  /webhook/req-meeting           │
└─────────────────┘     └────────┬─────────┘     └─────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌───────────────┐         ┌───────────────┐
            │  WebSocket    │         │  REST API     │
            │  Broadcast    │         │  /api/meetings│
            └───────┬───────┘         └───────┬───────┘
                    ▼                         ▼
            ┌───────────────┐         ┌───────────────┐
            │  Dashboard    │         │  Dashboard    │
            │  (Real-time)  │         │  (CRUD/Export)│
            └───────────────┘         └───────────────┘
```

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone and navigate
cd meetings

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, change MYSQL_ROOT_PASSWORD and DB_PASSWORD

# Start services (Docker Compose V2)
docker compose up -d

# View logs
docker compose logs -f app
```

The dashboard will be available at `http://localhost:5687` and webhook at `http://localhost:5687/webhook/req-meeting`.

### Initialize Default Settings

On first run, initialize default webhook settings via API:
```bash
curl -X POST http://localhost:5687/api/settings/initialize-defaults
```

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt

# Set up environment
cp .env.example .env
# Edit .env for local development (use SQLite for simplicity)

# Run database migrations (tables created automatically on startup)
# Start the application
uvicorn app.main:app --reload --host 0.0.0.0 --port 5687
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `production` | Application environment |
| `APP_HOST` | `0.0.0.0` | Host to bind the server |
| `APP_PORT` | `5687` | Port to bind the server |
| `DEBUG` | `false` | Enable debug mode |
| `DB_HOST` | `mysql` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `meetings_user` | MySQL username |
| `DB_PASSWORD` | `meetings_password` | MySQL password |
| `DB_NAME` | `meetings_db` | MySQL database name |
| `DATABASE_URL` | - | Full database URL (overrides individual settings) |
| `WEBHOOK_HOST` | `0.0.0.0` | Webhook listen IP (configurable via UI) |
| `WEBHOOK_PORT` | `5687` | Webhook listen port (configurable via UI) |
| `WEBHOOK_PATH` | `/webhook/req-meeting` | Webhook endpoint path (configurable via UI) |
| `CORS_ORIGINS` | `["http://localhost:5687"]` | Allowed CORS origins |
| `LOG_LEVEL` | `INFO` | Logging level |

### Webhook Configuration

The webhook endpoint can be configured via the **Settings** page in the dashboard:

- **Listen IP**: IP address to bind (e.g., `0.0.0.0` for all interfaces, `100.66.60.70` for specific interface)
- **Port**: Port number (default: `5687`)
- **Path**: Endpoint path (default: `/webhook/req-meeting`)

**Example configurations:**
- `http://100.66.60.70:5687/webhook/req-meeting`
- `http://100.122.130.97:5687/webhook/req-meeting`
- `http://localhost:5687/webhook/req-meeting`

> **Note**: Changes to webhook settings require application restart to take effect.

## Verified Endpoints

All endpoints tested and verified working:

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/health` | GET | ✅ | Application health check |
| `/webhook/health` | GET | ✅ | Webhook health check |
| `/webhook/req-meeting` | POST | ✅ | Receive meeting (primary & legacy formats) |
| `/api/meetings` | GET | ✅ | List meetings (paginated, filterable) |
| `/api/meetings/{id}` | GET | ✅ | Get single meeting |
| `/api/meetings/{id}` | PATCH | ✅ | Update meeting (activate/deactivate) |
| `/api/meetings/{id}` | DELETE | ✅ | Delete meeting |
| `/api/meetings/export/all` | GET | ✅ | Export all as JSON |
| `/api/meetings/export/csv` | GET | ✅ | Export all as CSV |
| `/api/settings` | GET | ✅ | Get all settings |
| `/api/settings/{key}` | GET | ✅ | Get setting by key |
| `/api/settings/{key}` | PUT | ✅ | Create/update setting |
| `/api/settings/webhook-url` | GET | ✅ | Get full webhook URL |
| `/api/settings/initialize-defaults` | POST | ✅ | Initialize default settings |
| `/ws` | WS | ✅ | WebSocket for real-time updates |

## API Documentation

### Webhook Endpoint

#### Receive Meeting Request
```
POST /webhook/req-meeting
Content-Type: application/json
```

The webhook accepts **two formats** for maximum compatibility:

**1. Primary Format:**
```json
{
  "recruiter_name": "John Doe",
  "contact_email": "john@example.com",
  "meeting_date": "2026-10-15T14:00:00Z",
  "meeting_duration": 30,
  "company_name": "Acme Corp",
  "job_opportunity": "Senior Software Engineer"
}
```

**2. Legacy/n8n Format (Backwards Compatible):**
```json
{
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "meeting_time": "2026-10-15T14:00:00Z",
  "meeting_duration": 30,
  "company_name": "Acme Corp",
  "job_opportunity": "Senior Software Engineer",
  "recruiter_name": "Jane Smith"
}
```

**Required fields (either format):**
- Name: `recruiter_name` (primary) OR `user_name` (legacy)
- Email: `contact_email` (primary) OR `user_email` (legacy)
- Date: `meeting_date` (primary) OR `meeting_time` (legacy)

**Optional fields:**
- `meeting_duration` - Meeting duration in minutes (default: 30, min: 5, max: 480)
- `company_name` - Caller's company
- `job_opportunity` - Job opportunity details

**Response:** `201 Created` with meeting object

**Overlap Detection:**
The webhook checks for overlapping meetings before creating a new one. A meeting is rejected with `409 Conflict` if its time range (meeting_time to meeting_time + meeting_duration) overlaps with any existing active meeting.

Overlap logic: `new_start < existing_end AND new_end > existing_start`

Error response includes detailed information:
```json
{
  "detail": {
    "error": "time_slot_taken",
    "message": "The requested meeting time slot overlaps with an existing active meeting",
    "requested_slot": {
      "start": "2026-10-15T14:30:00",
      "end": "2026-10-15T15:00:00",
      "duration_minutes": 30
    },
    "existing_meeting": {
      "id": 1,
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "meeting_time": "2026-10-15T14:00:00",
      "meeting_duration": 60,
      "meeting_end": "2026-10-15T15:00:00",
      "company_name": "Acme Corp",
      "recruiter_name": "Jane Smith"
    }
  }
}
```

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/meetings` | List meetings (paginated, filterable) |
| GET | `/api/meetings/{id}` | Get single meeting |
| PATCH | `/api/meetings/{id}` | Update meeting (activate/deactivate) |
| DELETE | `/api/meetings/{id}` | Delete meeting |
| GET | `/api/meetings/export/all` | Export all meetings as JSON |
| GET | `/api/meetings/export/csv` | Export all meetings as CSV |
| GET | `/api/settings` | Get all settings |
| GET | `/api/settings/{key}` | Get setting by key |
| PUT | `/api/settings/{key}` | Create/update setting |
| GET | `/api/settings/webhook-url` | Get full webhook URL |
| POST | `/api/settings/initialize-defaults` | Initialize default settings |

### Query Parameters for `/api/meetings`

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `page_size` | integer | Items per page (default: 20, max: 100) |
| `search` | string | Search in name, email, company, recruiter |
| `is_active` | boolean | Filter by active status |
| `sort` | string | Sort field:direction (e.g., `created_at:desc`) |

### WebSocket Endpoint

```
WS /ws
```

**Message Types:**
- `meeting_created` - New meeting received
- `meeting_updated` - Meeting status changed
- `meeting_deleted` - Meeting removed

**Example message:**
```json
{
  "type": "meeting_created",
  "data": {
    "id": 1,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "meeting_time": "2026-10-15T14:00:00Z",
    "meeting_duration": 30,
    "company_name": "Acme Corp",
    "job_opportunity": "Senior Engineer",
    "recruiter_name": "Jane Smith",
    "is_active": true,
    "created_at": "2026-09-27T10:00:00",
    "updated_at": "2026-09-27T10:00:00"
  }
}
```

## Dashboard Usage

### Dashboard Page
- **Statistics Cards** - Total, Active, Inactive, Today counts
- **Search** - Filter by name, email, company, or recruiter
- **Filters** - Status (Active/Inactive), Sort options, Page size
- **Table** - Sortable columns including Duration, inline actions
- **Actions per row:**
  - 👁 View Details - Full meeting information modal (includes duration)
  - ↻ Toggle - Activate/Deactivate
  - ⬇ Download - Export single meeting as JSON
  - 🗑 Delete - Permanent removal (with confirmation)
- **Bulk Export** - Download all as JSON or CSV (includes duration)
- **Pagination** - Navigate through pages

### Settings Page
- Configure webhook listen IP, port, and path
- Live preview of full webhook URL
- Copy URL to clipboard
- Reset to defaults
- Application info display

## Testing

### Run All Tests
```bash
# Using pytest directly
pytest tests/ -v

# With coverage
pytest tests/ --cov=app --cov-report=html

# In Docker test environment (Docker Compose V2)
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Test Structure
```
tests/
├── conftest.py          # Fixtures and configuration
├── test_webhook.py      # Webhook endpoint tests
├── test_meetings.py     # Meetings API tests
├── test_settings.py     # Settings API tests
└── test_websocket.py    # WebSocket tests
```

### Test Markers
```bash
# Run only webhook tests
pytest tests/ -m webhook -v

# Run only API tests
pytest tests/ -m api -v

# Run only WebSocket tests
pytest tests/ -m websocket -v

# Skip slow tests
pytest tests/ -m "not slow" -v
```

## Deployment

### Production Deployment

1. **Prepare environment:**
```bash
# Create production .env
cp .env.example .env.production
# Edit with secure passwords and production settings
```

2. **Deploy with Docker Compose (V2):**
```bash
docker compose -f docker-compose.yml --env-file .env.production up -d
```

3. **Configure reverse proxy (nginx):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5687;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. **Enable SSL (Let's Encrypt):**
```bash
certbot --nginx -d your-domain.com
```

### Health Checks

- Application: `GET /health`
- Webhook: `GET /webhook/health`
- Database: Automatic via Docker healthcheck

### Monitoring

The application exposes:
- Health endpoint with WebSocket connection count
- Structured logging (JSON format in production)
- Prometheus metrics can be added via `prometheus-fastapi-instrumentator`

## Database Schema

### `meetings` Table
```sql
CREATE TABLE meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    meeting_time DATETIME NOT NULL,
    meeting_duration INT NOT NULL DEFAULT 30,
    company_name VARCHAR(255),
    job_opportunity TEXT,
    recruiter_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ix_meetings_user_name (user_name),
    INDEX ix_meetings_user_email (user_email),
    INDEX ix_meetings_meeting_time (meeting_time),
    INDEX ix_meetings_is_active (is_active),
    INDEX ix_meetings_active_created (is_active, created_at),
    INDEX ix_meetings_email_active (user_email, is_active)
);
```

### `settings` Table
```sql
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) UNIQUE NOT NULL,
    `value` TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Project Structure

```
meetings/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Configuration management
│   ├── database.py          # Database connection & sessions
│   ├── models/
│   │   ├── __init__.py
│   │   ├── meeting.py       # Meeting SQLAlchemy model
│   │   └── setting.py       # Settings SQLAlchemy model
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── meeting.py       # Pydantic schemas for meetings
│   │   └── setting.py       # Pydantic schemas for settings
│   ├── api/
│   │   ├── __init__.py
│   │   ├── webhook.py       # Webhook endpoint
│   │   ├── meetings.py      # Meetings REST API
│   │   └── settings.py      # Settings REST API
│   ├── services/
│   │   ├── __init__.py
│   │   └── websocket.py     # WebSocket manager
│   └── static/
│       ├── index.html       # Dashboard HTML
│       ├── style.css        # Modern CSS with CSS variables
│       └── app.js           # Vanilla JS dashboard logic
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Pytest fixtures
│   ├── test_webhook.py
│   ├── test_meetings.py
│   ├── test_settings.py
│   └── test_websocket.py
├── Dockerfile               # Multi-stage production build
├── Dockerfile.test          # Test environment
├── docker-compose.yml       # Production deployment
├── docker-compose.test.yml  # Test deployment
├── init-db.sql              # Database initialization
├── requirements.txt         # Production dependencies
├── requirements-test.txt    # Test dependencies
├── pytest.ini              # Pytest configuration
├── .env.example            # Environment template
├── .env.test.example       # Test environment template
└── README.md               # This file
```

## Troubleshooting

### Common Issues

**Webhook not receiving requests:**
- Verify the webhook sender is sending to correct URL (`http://YOUR_IP:5687/webhook/req-meeting`)
- Check firewall allows port 5687
- Verify `WEBHOOK_HOST` is set to `0.0.0.0` (not `localhost` or `127.0.0.1`)

**Database connection failed:**
- Ensure MySQL container is healthy: `docker-compose ps`
- Check credentials in `.env` match MySQL environment variables
- View logs: `docker-compose logs mysql`

**WebSocket not connecting:**
- Ensure reverse proxy supports WebSocket upgrades
- Check CORS origins include your domain
- Browser console for connection errors

**Settings not persisting:**
- Settings are stored in MySQL `settings` table
- Changes require app restart to affect webhook binding
- Use Settings page or API to modify

### Logs

```bash
# Application logs
docker compose logs -f app

# Database logs
docker compose logs -f mysql

# All logs
docker compose logs -f
```

## Development

### Adding New Features

1. Create model in `app/models/`
2. Create schema in `app/schemas/`
3. Add API routes in `app/api/`
4. Update database (handled automatically on startup)
5. Add tests in `tests/`
6. Update frontend in `app/static/` if needed

### Code Style

```bash
# Format code
black app/ tests/

# Lint
ruff check app/ tests/

# Type check
mypy app/
```

## License

MIT License - Feel free to use and modify for your needs.

## Support

For issues and feature requests, please open a GitHub issue.

Note: 
 docker exec meetings-mysql mysql -u meetings_user -pmeetings_password meetings_db -e "ALTER TABLE meetings ADD COLUMN meeting_duration INT NOT NULL DEFAULT 30;"
 docker compose -f docker-compose.yml build --no-cache
docker compose up -d
