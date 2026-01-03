# DataAPI

Data Acquisition and Visualization Platform.

**Documentation:** Start at `docs/INDEX.md` (canonical index).

## Overview

DataAPI is a comprehensive system for gathering, storing, and visualizing data. It acts as a central hub for various data streams and provides both a web interface for users and an API for external tools and integrations.

### Key Features

*   **Dual-Mode Database**: Flexible configuration supports both local MongoDB instances and cloud-based MongoDB clusters (e.g., Atlas).
*   **Built-in Frontend**: A complete web interface (EJS-based) for visualizing live data, managing files, and monitoring system health.
*   **Live Data Services**: Dedicated background services that continuously fetch and archive data from external sources.
*   **Integrations**: Native support for n8n workflows and external event sinking.

---

## Live Data Services

The application includes a powerful "Live Data" engine that autonomously tracks and records real-time information:

*   **ISS Tracker**: Real-time position of the International Space Station.
*   **Weather**: Local weather conditions and barometric pressure tracking.
*   **Earthquakes**: USGS earthquake data ingestion.
*   **Tides & Marine**: Ocean conditions and wave heights.
*   **Satellite Data**: TLE (Two-Line Element) set tracking via CelesTrak.

These services run in the background and populate the database, making historical data available for visualization and analysis.

---

## n8n Integration (Addition)

DataAPI is designed to extend its capabilities through n8n. While the platform functions independently, adding n8n allows for advanced workflow automation and event processing.

### Capabilities
*   **Event Sink**: Send events from n8n to DataAPI's `/integrations/events/n8n` endpoint for logging and centralization.
*   **File Operations**: Trigger file system scans and management tasks via API.
*   **Data Access**: Use n8n to query stored weather, quake, or user data for reports.

### Key Endpoints for n8n

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/storage/scan` | POST | Start a file scan |
| `/api/v1/storage/status/:id` | GET | Get scan status |
| `/integrations/events/n8n` | POST | Event sink (n8n → DataAPI) |

---

## Getting Started

### Automated Deployment (Recommended)

For automated deployment on Linux Mint / Ubuntu (especially TrueNAS SCALE VMs):

```bash
# 1. Review prerequisites
cat DEPLOY_PREREQUISITES.md

# 2. Run preflight check
sudo ./scripts/preflight_check.sh

# 3. Configure deployment
cp deploy.env.example deploy.env
nano deploy.env  # Edit with your credentials

# 4. Deploy
set -a; source deploy.env; set +a; sudo -E ./deploy_dataapi_mint.sh
```

**Documentation:**
- 📋 [`DEPLOY_PREREQUISITES.md`](DEPLOY_PREREQUISITES.md) - TrueNAS/VM setup requirements
- ⚡ [`QUICK_START.md`](QUICK_START.md) - Quick deployment guide  
- 🔧 [`DEPLOY_CONFIG_GUIDE.md`](DEPLOY_CONFIG_GUIDE.md) - Environment variable configuration
- 📝 [`DEPLOYMENT_FIXES_SUMMARY.md`](DEPLOYMENT_FIXES_SUMMARY.md) - What was fixed

### Running Locally (Simple)

1. Create `.env` (example keys below; do not commit secrets):

```bash
NODE_ENV=development
PORT=3003

# Option A: Local MongoDB
MONGO_URL=mongodb://localhost:27017/
MONGO_DB_NAME=data

# Option B: Cloud MongoDB (e.g., Atlas)
# MONGO_URL=mongodb+srv://user:password@cluster0.example.net/
# MONGO_DB_NAME=data
# MONGO_OPTIONS=?retryWrites=true&w=majority

DATAAPI_API_KEY=change-me-long-random
```

2. Install and run:

```bash
npm install
npm run agent
```

3. Verify:
   *   Open browser: `http://localhost:3003` (Login/Register)
   *   API Check: `curl -sS http://localhost:3003/health`

---

## Testing

The test suite uses Jest + Supertest and runs against an in-memory MongoDB instance (mongodb-memory-server).

```bash
npm test
```

Useful variants:

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Debugging (detect open handles; slower)
npm run test:debug:handles
```

Note: In `NODE_ENV=test`, external API proxy endpoints return `503` to avoid slow/flaky outbound network calls during tests.

---

## Database Configuration

The application is designed to be database-agnostic regarding location. It can connect to:
*   **Local MongoDB**: Standard for development or self-hosted setups.
*   **Cloud MongoDB**: Fully supported via connection string configuration (e.g., MongoDB Atlas).

Configuration is handled in `config/config.js` and controlled via environment variables (`MONGO_URL`, `MONGO_DB_NAME`, `MONGO_OPTIONS`).
