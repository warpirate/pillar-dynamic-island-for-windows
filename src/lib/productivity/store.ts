import {
  PRODUCTIVITY_SCHEMA_VERSION,
  type CalendarEventItem,
  type NoteItem,
  type ProductivitySnapshot,
  type ProductivityState,
  type TaskItem,
} from "../../types/productivity";

export const PRODUCTIVITY_STORAGE_KEY = "pillar_productivity_state_v1";

export function createEmptyProductivityState(): ProductivityState {
  return {
    schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
    updatedAt: Date.now(),
    status: "idle",
    tasks: [],
    notes: [],
    calendarEvents: [],
  };
}

export function loadProductivityState(): ProductivityState {
  try {
    const raw = localStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
    if (!raw) return createEmptyProductivityState();
    const parsed = JSON.parse(raw) as ProductivityState;
    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes) || !Array.isArray(parsed.calendarEvents)) {
      return createEmptyProductivityState();
    }
    return {
      ...createEmptyProductivityState(),
      ...parsed,
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
    };
  } catch {
    return createEmptyProductivityState();
  }
}

export function saveProductivityState(state: ProductivityState): void {
  try {
    localStorage.setItem(PRODUCTIVITY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors in app runtime
  }
}

export function createTask(title: string, dueAt?: number): TaskItem {
  const now = Date.now();
  return {
    id: `task-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim().slice(0, 120),
    completed: false,
    dueAt,
    priority: "medium",
    createdAt: now,
    updatedAt: now,
  };
}

export function createNote(title: string, content: string): NoteItem {
  const now = Date.now();
  return {
    id: `note-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim().slice(0, 120) || "Untitled note",
    content: content.slice(0, 2000),
    createdAt: now,
    updatedAt: now,
  };
}

export function createCalendarEvent(
  title: string,
  startsAt: number,
  endsAt: number
): CalendarEventItem {
  const now = Date.now();
  return {
    id: `event-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim().slice(0, 120),
    startsAt,
    endsAt,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function toProductivitySnapshot(state: ProductivityState): ProductivitySnapshot {
  return {
    schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
    exportedAt: Date.now(),
    state,
  };
}
