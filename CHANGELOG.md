# Changelog

All notable changes to DataAPI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- OpenAPI/Swagger specification
- Replace `moment.js` with `date-fns`
- Database index creation script
- Input validation enhancement with `express-validator`
- Security test suite

---

## [2.1.2] - 2026-01-01

### Changed
- **Documentation Revision**: Comprehensive audit and cleanup of all documentation
  - Standardized MongoDB version references to 8.0
  - Updated DOCS_INDEX.md with current structure
  - Added deprecation notice to DEPLOY_MINT.md (legacy workflow)

### Archived
- Moved `DEPLOYMENT_FIXES_SUMMARY.md` to `docs/archive/deployment/`
- Moved `CODEBASE_REVIEW.md` to `docs/archive/reviews/`

### Fixed
- MongoDB version inconsistency across deployment docs (7.0 → 8.0)

---

## [2.1.1] - 2025-12-31

### Added
- Comprehensive peer review document (`docs/PEER_REVIEW_2025-12-31.md`)
- Datalake Janitor API endpoints (`/api/v1/janitor/*`)
- RAG file metadata endpoint for n8n integration

### Changed
- Replaced 500+ `console.log` statements with Winston logger
- Rotated all exposed secrets and removed from git history

### Security
- Fixed exposed `.env` file in git repository
- Corrected file permissions on sensitive files

---

## [2.1.0] - 2025-12-26

### Added
- Full RBAC (Role-Based Access Control) implementation
  - 4 hierarchical roles: guest, user, editor, admin
  - `middleware/rbac.js` with role/permission checks
  - Protected 15+ API endpoints
  - Documentation in `RBAC_MATRIX.md`
- CI/CD pipeline with GitHub Actions
  - Dual deployment (cloud + local)
  - Self-hosted runner on AgentX machine
  - Automated testing before deployment
- n8n integration event sink (`/integrations/events/n8n`)
- Storage and File Browser API (`/api/v1/files/*`)

### Changed
- Migrated n8n trigger routes to AgentX (DataAPI is now headless)
- Consolidated fileExportController variants into single class
- Migrated auth/user operations to Mongoose (was native driver)

### Removed
- Mock data from external API endpoints (now fetches real data)
- Duplicate controller files

### Fixed
- Password hashing now handled by Mongoose pre-save hook
- Admin routes properly protected with `requireAdmin` middleware

---

## [2.0.0] - 2025-12-01

### Added
- OpenAI ChatKit integration for admin pages
- OpenAI Realtime Voice API integration
- Voice commands configuration system
- SSE (Server-Sent Events) for real-time feeds
- Storage scanning with SHA256 hashing

### Changed
- Architecture shift: DataAPI is now a headless tool server for AgentX
- PM2 ecosystem management shared with AgentX

### Infrastructure
- TrueNAS SCALE VM deployment support
- Preflight check script for deployment validation
- Bridge network configuration for VM-to-host communication

---

## [1.x.x] - 2025 (Earlier)

### Features
- Initial Express.js REST API
- MongoDB integration (Mongoose + Native Driver)
- Live data services (ISS, Weather, Earthquakes, Tides)
- EJS-based web interface
- Session-based authentication
- Basic user management

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes, architectural shifts
- **Minor (0.X.0)**: New features, significant enhancements
- **Patch (0.0.X)**: Bug fixes, documentation updates

---

[Unreleased]: https://github.com/WindriderQc/DataAPI/compare/v2.1.2...HEAD
[2.1.2]: https://github.com/WindriderQc/DataAPI/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/WindriderQc/DataAPI/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/WindriderQc/DataAPI/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/WindriderQc/DataAPI/releases/tag/v2.0.0
