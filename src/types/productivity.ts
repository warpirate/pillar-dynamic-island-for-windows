export type ProductivityStatus = "idle" | "loading" | "conflict" | "degraded";

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: number;
  priority: "low" | "medium" | "high";
  createdAt: number;
  updatedAt: number;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  source: "manual" | "external";
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProductivityState {
  schemaVersion: number;
  updatedAt: number;
  status: ProductivityStatus;
  tasks: TaskItem[];
  notes: NoteItem[];
  calendarEvents: CalendarEventItem[];
}

export interface ProductivitySnapshot {
  schemaVersion: number;
  exportedAt: number;
  state: ProductivityState;
}

export const PRODUCTIVITY_SCHEMA_VERSION = 1;
