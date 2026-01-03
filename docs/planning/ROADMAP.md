# DataAPI Roadmap

**Last Updated:** 2026-01-03

This is the DataAPI-specific roadmap. For the canonical stack-wide roadmap, see `AgentX/docs/planning/ROADMAP.md`.

---

## Now
- [ ] Normalize docs entrypoints (ensure `docs/INDEX.md` is canonical)
- [ ] Confirm DataAPI ↔ AgentX integration assumptions are documented consistently:
  - DataAPI tool endpoints are under `/api/v1/*`
  - AgentX calls DataAPI server-side and browsers never call DataAPI directly
  - AgentX authenticates with `x-api-key`

## Next
- [ ] Clarify ownership/location of backup scripts used by AgentX routes:
  - DataAPI currently hosts backup scripts under `scripts/` (referenced by AgentX plan)
  - Decide whether to keep them here (and document contract), or copy into AgentX

## Later
- [ ] Expand tests around tool endpoints (only if gaps are found)

