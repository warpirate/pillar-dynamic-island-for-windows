# Phase 5 Architecture - Advanced Features

## Goal

Add productivity and ecosystem-level capability only after platform/runtime stability is proven.

## In Scope

- Productivity suite primitives (tasks/calendar/notes)
- Advanced system integration (global shortcuts/tray/workflows)
- Cloud sync and backup architecture skeleton

## Out of Scope

- Unbounded feature sprawl
- Deep account monetization complexity in first pass

## Architecture Decisions

- Introduce domain boundaries: productivity, system integration, cloud sync.
- Keep data models portable and versioned for backup/restore.
- Design for opt-in cloud behavior and conflict resolution from day one.

## Verification Gates

- Feature modules do not compromise startup responsiveness
- Sync/backup flows protect local data integrity
- Global shortcuts and tray actions are deterministic

## Exit Criteria

- Advanced features operate without destabilizing core dynamic island behavior
- Data portability and recovery paths are verified
