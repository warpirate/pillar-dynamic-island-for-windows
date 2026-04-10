# Architecture Principles (Non-Negotiable)

## 1) Reliability First

- Critical hooks must fail gracefully without collapsing UI.
- Crash handling paths must exist at app boundary.
- Error handling cannot be "catch and ignore" unless intentionally justified.

## 2) Typed Integration Boundaries

- Tauri command inputs/outputs must remain typed at hook boundary.
- Any new command must include a frontend type contract.

## 3) Accessibility as Core Behavior

- Keyboard-first navigation for every interactive control.
- ARIA semantics are part of done criteria, not polish.
- Screen reader announcements must be intentional and non-spammy.

## 4) Performance Budgeting

- Polling is adaptive by default.
- No uncontrolled timers/intervals in component lifecycles.
- Animation choices prioritize transform/opacity.

## 5) Delivery Discipline

- Small, reversible changes over heroic rewrites.
- Each phase file must define in-scope and out-of-scope.
- Exit criteria must be measurable and verifiable.
