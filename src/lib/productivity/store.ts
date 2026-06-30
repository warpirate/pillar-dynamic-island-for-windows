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

// --- Per-item validators ----------------------------------------------------
// Defensive parsers so a single corrupt entry (manual localStorage edit, partial
// write during shutdown, schema drift) can't crash the loader or pollute state.

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validateTask(raw: unknown): TaskItem | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id) || typeof raw.title !== "string") return null;
  if (typeof raw.completed !== "boolean") return null;
  if (!isFiniteNumber(raw.createdAt) || !isFiniteNumber(raw.updatedAt)) return null;
  const priority = raw.priority;
  const validPriority: TaskItem["priority"] =
    priority === "low" || priority === "high" ? priority : "medium";
  return {
    id: raw.id,
    title: raw.title.slice(0, 120),
    completed: raw.completed,
    dueAt: isFiniteNumber(raw.dueAt) ? raw.dueAt : undefined,
    priority: validPriority,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function validateNote(raw: unknown): NoteItem | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id)) return null;
  if (typeof raw.title !== "string" || typeof raw.content !== "string") return null;
  if (!isFiniteNumber(raw.createdAt) || !isFiniteNumber(raw.updatedAt)) return null;
  return {
    id: raw.id,
    title: raw.title.slice(0, 120),
    content: raw.content.slice(0, 2000),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function validateCalendarEvent(raw: unknown): CalendarEventItem | null {
  if (!isObject(raw)) return null;
  if (!isNonEmptyString(raw.id) || typeof raw.title !== "string") return null;
  if (!isFiniteNumber(raw.startsAt) || !isFiniteNumber(raw.endsAt)) return null;
  if (!isFiniteNumber(raw.createdAt) || !isFiniteNumber(raw.updatedAt)) return null;
  const source = raw.source === "external" ? "external" : "manual";
  return {
    id: raw.id,
    title: raw.title.slice(0, 120),
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    source,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 2000) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function filterValid<T>(items: unknown[], validator: (raw: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const item of items) {
    const valid = validator(item);
    if (valid) out.push(valid);
  }
  return out;
}

export function loadProductivityState(): ProductivityState {
  try {
    const raw = localStorage.getItem(PRODUCTIVITY_STORAGE_KEY);
    if (!raw) return createEmptyProductivityState();
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return createEmptyProductivityState();

    const tasksSrc = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const notesSrc = Array.isArray(parsed.notes) ? parsed.notes : [];
    const eventsSrc = Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [];

    return {
      schemaVersion: PRODUCTIVITY_SCHEMA_VERSION,
      updatedAt: isFiniteNumber(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
      status: "idle",
      tasks: filterValid<TaskItem>(tasksSrc, validateTask),
      notes: filterValid<NoteItem>(notesSrc, validateNote),
      calendarEvents: filterValid<CalendarEventItem>(eventsSrc, validateCalendarEvent),
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
