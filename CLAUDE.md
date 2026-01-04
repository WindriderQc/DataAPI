# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation (Canonical)

- DataAPI docs index (start here): [docs/INDEX.md](docs/INDEX.md)
- Roadmap + todos (DataAPI): [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md)
- Progression log (DataAPI): [docs/planning/PROGRESSION_LOG.md](docs/planning/PROGRESSION_LOG.md)

AgentX is the SBQC stack system-of-record for stack-level architecture and the canonical roadmap:
- AgentX docs index (in this workspace): [../AgentX/docs/INDEX.md](../AgentX/docs/INDEX.md)

## Commands

### Development
```bash
npm run dev          # nodemon data_serv.js
npm start            # node data_serv.js
npm test             # jest (NODE_ENV=test)
```

### Quality
```bash
npm run lint
npm run format
```

## Notes

- Permanent documentation lives under `docs/`.
- Root-level legacy docs may exist as “Moved” stubs for backward compatibility.
