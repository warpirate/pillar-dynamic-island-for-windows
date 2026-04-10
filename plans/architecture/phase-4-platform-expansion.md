# Phase 4 Architecture - Platform Expansion

## Goal

Extend PILLAR beyond Windows through explicit platform abstraction, not copy-paste divergence.

## In Scope

- macOS integration layer
- Linux integration layer
- Platform-specific command and capability mapping

## Out of Scope

- Full feature parity in first iteration
- Mobile productization

## Architecture Decisions

- Define platform capability interface first, then implement adapters.
- Keep shared UI/business logic platform-agnostic.
- Gate unsupported features explicitly instead of silently failing.

## Verification Gates

- Windows behavior remains unchanged
- Platform adapters compile and degrade safely on unsupported APIs
- Core modules can run with partial capabilities

## Exit Criteria

- Platform abstraction exists and is used by core features
- At least baseline functionality operational per target platform
