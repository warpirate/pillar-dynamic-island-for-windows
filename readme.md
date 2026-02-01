🧠 PRODUCT SPEC PROMPT

Windows Dynamic Pill (Dynamic Island–Style System Overlay)

PRODUCT OVERVIEW

Build a Windows Dynamic Island–style system overlay called Dynamic Pill.

Dynamic Pill is a lightweight, always-on-top, transparent overlay window that appears under the webcam at the top-center of the screen, launches at Windows boot, and behaves like a system-native UI element, not an app.

It must be:

Visually minimal

Animation-driven

Event-based

Near-zero resource usage when idle

CORE DESIGN PRINCIPLES

Feels built into Windows

Never interrupts the user

Never steals keyboard focus

Never animates unless meaningful

One surface, one responsibility

This is not a widget, tray app, or notification center.

WINDOW & SYSTEM BEHAVIOR
Window Properties

Borderless

Per-pixel transparent

Always-on-top

Non-activating (never steals focus)

Hidden from taskbar & Alt+Tab

DPI-aware

GPU-accelerated

Click-through when idle

Positioning

Anchored to top-center of primary display

Positioned just below webcam/camera area

Repositions on:

Resolution change

DPI scaling

Monitor switch

Fullscreen app enter/exit

STARTUP & BOOT ANIMATION
Startup Flow

App launches at Windows login

Overlay window created hidden

Wait for desktop stability

Play boot animation once

Enter idle state

Boot Animation

A small glowing dot appears under the camera

Dot morphs horizontally into a pill

Uses shape interpolation, not scale

Spring-based motion with slight overshoot

Total duration: ~800–1000ms

IDLE STATE (LEVEL 0)
Behavior

Rendering paused

No animations

No timers

Click-through enabled

Zero CPU usage

Visual

Small black glass pill

No text

No icons

No glow

Subtle blur & shadow

This state is the default equilibrium.

HOVER STATE (LEVEL 1 — PREVIEW)
Trigger

Mouse enters pill region

100–150ms delay to prevent accidental activation

Hover Expansion

Width expands slightly

Height increases minimally

Corner radius interpolates

Blur increases subtly

Shadow softens

Visual Rules

No text

No buttons

Optional micro indicators only

No opacity fades

No scale transforms

Performance

One animation per hover

Cancels immediately on mouse exit

Renderer sleeps after animation ends

CLICK STATE (LEVEL 2 — EXPANDED)
Trigger

Mouse click while in hover state

Expansion Mechanics

Expansion is anchored to top-center

Expands downward only

Width expands first

Height follows after short delay

Content mounts lazily

Expanded Layout

Top row: icon / title / subtitle

Bottom row: contextual controls

No dividers

Soft spacing

Floating elements

Rounded geometry preserved

Interaction

Mouse-only

No keyboard focus

Buttons respond with micro motion (scale + shadow)

COLLAPSE BEHAVIOR
Triggers

Click outside

Mouse exit timeout

Higher-priority system event

Collapse Order

Content disappears

Height collapses

Width collapses

Returns to hover or idle

No abrupt transitions.
No fade-outs.

STATE MACHINE (MANDATORY)

Dynamic Pill is state-driven, not event-driven.

Core States

BOOT

IDLE

HOVER

EXPANDED

MEDIA_ACTIVE

CALL_ACTIVE

TIMER

NOTIFICATION

Rules

Only one dominant visual state

All transitions are explicit

No state mutation without transition approval

PRIORITY SYSTEM

Higher-priority states override lower ones.

Priority order (example):

Call

Recording

Timer alert

Media playback

Notification

Idle

Lower-priority states collapse into:

Dots

Color indicators

Paused visuals

ANIMATION SYSTEM

Physics-based (spring)

Interruptible

Reversible

Velocity-aware

No chained animations

No simultaneous opacity + geometry animation

Animations must feel:

Elastic

Controlled

Purposeful

PERFORMANCE CONSTRAINTS (CRITICAL)
CPU

~0% when idle

No polling

Event-driven only

GPU

Single surface

No overdraw

No nested compositors

Memory

Target < 50MB

Lazy-load expanded UI

Destroy UI on collapse

Power

Suspend on lock screen

Suspend on fullscreen apps

No wake locks

No background loops

FAILURE HANDLING

Explorer restart → reattach & reposition

Display changes → recalc position

App crash → silent restart

Games/fullscreen → auto-hide

SECURITY & TRUST

No keylogging

No screen capture

No global hooks unless required

Minimal permissions

FINAL PRODUCT DEFINITION

A single always-on-top transparent GPU-composited window, driven by a finite state machine, that renders only when meaningful, expands on hover, commits on click, and consumes near-zero resources when idle.

IMPLEMENTATION NOTE FOR AI

Prefer event subscriptions over polling

Prefer layout-driven animations

Renderer must sleep when idle

Keyboard focus must never be captured

UI should feel OS-native, not app-like