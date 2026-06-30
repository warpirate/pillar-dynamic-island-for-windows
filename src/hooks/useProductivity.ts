import { useCallback, useEffect, useRef, useState } from "react";
import { tauriInvoke } from "../lib/tauri";
import {
  createCalendarEvent,
  createEmptyProductivityState,
  createNote,
  createTask,
  loadProductivityState,
  saveProductivityState,
  toProductivitySnapshot,
} from "../lib/productivity/store";
import type { NoteItem, ProductivityState, TaskItem } from "../types/productivity";
import type { SyncValidationResult } from "../types/sync";

interface UseProductivityReturn {
  state: ProductivityState;
  addTask: (title: string, dueAt?: number) => void;
  toggleTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  addNote: (title: string, content: string) => void;
  updateNote: (note: NoteItem) => void;
  removeNote: (noteId: string) => void;
  addAgendaEvent: (title: string, startsAt: number, endsAt: number) => void;
  clearCompletedTasks: () => void;
  exportBackup: () => Promise<SyncValidationResult | null>;
  importBackup: (mode: "preview" | "apply") => Promise<SyncValidationResult | null>;
}

function withUpdatedState(prev: ProductivityState, patch: Partial<ProductivityState>): ProductivityState {
  return {
    ...prev,
    ...patch,
    updatedAt: Date.now(),
  };
}

export function useProductivity(): UseProductivityReturn {
  const [state, setState] = useState<ProductivityState>(() => loadProductivityState());
  // Mirror state into a ref so async callbacks can read the latest snapshot
  // without being included in their deps (and re-created on every keystroke).
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveProductivityState(state);
  }, [state]);

  const addTask = useCallback((title: string, dueAt?: number) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const nextTask = createTask(trimmed, dueAt);
    setState((prev) => withUpdatedState(prev, { tasks: [nextTask, ...prev.tasks] }));
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setState((prev) =>
      withUpdatedState(prev, {
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed, updatedAt: Date.now() } : task
        ),
      })
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setState((prev) => withUpdatedState(prev, { tasks: prev.tasks.filter((task) => task.id !== taskId) }));
  }, []);

  const addNote = useCallback((title: string, content: string) => {
    if (!title.trim() && !content.trim()) return;
    const nextNote = createNote(title, content);
    setState((prev) => withUpdatedState(prev, { notes: [nextNote, ...prev.notes] }));
  }, []);

  const updateNote = useCallback((note: NoteItem) => {
    setState((prev) =>
      withUpdatedState(prev, {
        notes: prev.notes.map((item) => (item.id === note.id ? { ...note, updatedAt: Date.now() } : item)),
      })
    );
  }, []);

  const removeNote = useCallback((noteId: string) => {
    setState((prev) => withUpdatedState(prev, { notes: prev.notes.filter((note) => note.id !== noteId) }));
  }, []);

  const addAgendaEvent = useCallback((title: string, startsAt: number, endsAt: number) => {
    if (!title.trim() || endsAt <= startsAt) return;
    const nextEvent = createCalendarEvent(title, startsAt, endsAt);
    setState((prev) =>
      withUpdatedState(prev, {
        calendarEvents: [...prev.calendarEvents, nextEvent].sort((a, b) => a.startsAt - b.startsAt),
      })
    );
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setState((prev) => withUpdatedState(prev, { tasks: prev.tasks.filter((task) => !task.completed) }));
  }, []);

  const exportBackup = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    // Read latest state via ref so the callback identity stays stable across
    // every keystroke — otherwise downstream memoized consumers thrash.
    const snapshot = toProductivitySnapshot(stateRef.current);
    try {
      const result = await tauriInvoke<SyncValidationResult>("export_productivity_backup", { snapshot });
      setState((prev) => ({ ...prev, status: result?.valid ? "idle" : "conflict" }));
      return result;
    } catch {
      setState((prev) => ({ ...prev, status: "degraded" }));
      return null;
    }
  }, []);

  const importBackup = useCallback(async (mode: "preview" | "apply") => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const result = await tauriInvoke<{
        validation: SyncValidationResult;
        snapshot?: { state: ProductivityState };
      }>("import_productivity_backup", { apply: mode === "apply" });
      if (!result) {
        setState((prev) => ({ ...prev, status: "degraded" }));
        return null;
      }
      if (mode === "apply" && result.snapshot?.state) {
        setState({
          ...createEmptyProductivityState(),
          ...result.snapshot.state,
          status: result.validation.valid ? "idle" : "conflict",
          updatedAt: Date.now(),
        });
      } else {
        setState((prev) => ({ ...prev, status: result.validation.valid ? "idle" : "conflict" }));
      }
      return result.validation;
    } catch {
      setState((prev) => ({ ...prev, status: "degraded" }));
      return null;
    }
  }, []);

  return {
    state,
    addTask,
    toggleTask,
    removeTask,
    addNote,
    updateNote,
    removeNote,
    addAgendaEvent,
    clearCompletedTasks,
    exportBackup,
    importBackup,
  };
}

export type { TaskItem };
