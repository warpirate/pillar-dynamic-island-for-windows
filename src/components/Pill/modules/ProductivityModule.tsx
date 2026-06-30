import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { NoteItem, ProductivityState } from "../../../types/productivity";
import { microInteractions } from "../animations";

type ProductivityView = "tasks" | "notes" | "agenda";

const VIEW_LABELS = { tasks: "Tasks", notes: "Notes", agenda: "Agenda" } as const;

function statusLabel(status: ProductivityState["status"]): string | null {
  switch (status) {
    case "loading":
      return "Working…";
    case "conflict":
      return "Sync conflict";
    case "degraded":
      return "Backup unavailable";
    default:
      return null;
  }
}

interface ProductivityModuleProps {
  state: ProductivityState;
  onAddTask: (title: string) => void;
  onToggleTask: (taskId: string) => void;
  onRemoveTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onAddNote: (title: string, content: string) => void;
  onUpdateNote: (note: NoteItem) => void;
  onRemoveNote: (noteId: string) => void;
  onAddEvent: (title: string, startsAt: number, endsAt: number) => void;
  onExportBackup: () => Promise<void>;
  onPreviewImport: () => Promise<void>;
  onApplyImport: () => Promise<void>;
}

export function ProductivityModule({
  state,
  onAddTask,
  onToggleTask,
  onRemoveTask,
  onClearCompleted,
  onAddNote,
  onUpdateNote,
  onRemoveNote,
  onAddEvent,
  onExportBackup,
  onPreviewImport,
  onApplyImport,
}: ProductivityModuleProps) {
  const [view, setView] = useState<ProductivityView>("tasks");
  const [taskInput, setTaskInput] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventError, setEventError] = useState("");
  const [pendingRemoveTaskId, setPendingRemoveTaskId] = useState<string | null>(null);
  const [pendingRemoveNoteId, setPendingRemoveNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const completedCount = useMemo(() => state.tasks.filter((t) => t.completed).length, [state.tasks]);

  const handleRemoveTaskClick = (taskId: string) => {
    if (pendingRemoveTaskId === taskId) {
      setPendingRemoveTaskId(null);
      onRemoveTask(taskId);
      return;
    }
    setPendingRemoveTaskId(taskId);
    window.setTimeout(() => {
      setPendingRemoveTaskId((current) => (current === taskId ? null : current));
    }, 3000);
  };

  const handleRemoveNoteClick = (noteId: string) => {
    if (pendingRemoveNoteId === noteId) {
      setPendingRemoveNoteId(null);
      onRemoveNote(noteId);
      return;
    }
    setPendingRemoveNoteId(noteId);
    window.setTimeout(() => {
      setPendingRemoveNoteId((current) => (current === noteId ? null : current));
    }, 3000);
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setView("notes");
  };

  const handleSaveNote = () => {
    const editingNote = editingNoteId ? state.notes.find((n) => n.id === editingNoteId) : undefined;
    if (editingNote) {
      onUpdateNote({ ...editingNote, title: noteTitle, content: noteContent });
    } else {
      onAddNote(noteTitle, noteContent);
    }
    setEditingNoteId(null);
    setNoteTitle("");
    setNoteContent("");
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center justify-between">
        <div className="rounded bg-white/10 p-[2px] flex items-center">
          {(["tasks", "notes", "agenda"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`px-2 py-0.5 text-[10px] rounded ${view === id ? "bg-white/20 text-white" : "text-white/70"}`}
              onClick={() => setView(id)}
            >
              {VIEW_LABELS[id]}
            </button>
          ))}
        </div>
        {statusLabel(state.status) && <span className="text-[10px] text-white/60">{statusLabel(state.status)}</span>}
      </div>

      {view === "tasks" && (
        <div className="flex flex-col gap-1.5 min-h-0">
          <div className="flex gap-1">
            <input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Add task..."
              className="flex-1 bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none"
            />
            <button
              type="button"
              disabled={!taskInput.trim()}
              className="px-2 py-1 rounded bg-white/20 text-[11px] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                onAddTask(taskInput);
                setTaskInput("");
              }}
            >
              Add
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span>{state.tasks.length} tasks</span>
            <button type="button" onClick={onClearCompleted} className="hover:text-white/90">
              Clear completed ({completedCount})
            </button>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
            {state.tasks.map((task) => (
              <motion.div key={task.id} className="bg-white/8 rounded px-2 py-1 flex items-center gap-2" {...microInteractions.card}>
                <button type="button" onClick={() => onToggleTask(task.id)} className="text-[11px]">
                  {task.completed ? "☑" : "☐"}
                </button>
                <span className={`text-[12px] flex-1 ${task.completed ? "line-through text-white/45" : "text-white/85"}`}>
                  {task.title}
                </span>
                <button
                  type="button"
                  className={`text-[10px] hover:text-white ${pendingRemoveTaskId === task.id ? "text-red-300" : "text-white/60"}`}
                  onClick={() => handleRemoveTaskClick(task.id)}
                  onBlur={() => setPendingRemoveTaskId((current) => (current === task.id ? null : current))}
                >
                  {pendingRemoveTaskId === task.id ? "confirm?" : "remove"}
                </button>
              </motion.div>
            ))}
            {state.tasks.length === 0 && <div className="text-[11px] text-white/55">No tasks yet.</div>}
          </div>
        </div>
      )}

      {view === "notes" && (
        <div className="flex flex-col gap-1.5 min-h-0">
          <input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title..."
            maxLength={120}
            className="bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none"
          />
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write note..."
            maxLength={2000}
            className="bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none min-h-[64px]"
          />
          <button
            type="button"
            disabled={!noteTitle.trim()}
            className="px-2 py-1 rounded bg-white/20 text-[11px] text-white self-start disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSaveNote}
          >
            {editingNoteId ? "Update note" : "Save note"}
          </button>
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
            {state.notes.map((note) => (
              <div key={note.id} className="bg-white/8 rounded px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[12px] text-white/90 truncate">{note.title}</strong>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[10px] text-white/60 hover:text-white"
                      onClick={() => handleEditNote(note)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`text-[10px] hover:text-white ${pendingRemoveNoteId === note.id ? "text-red-300" : "text-white/60"}`}
                      onClick={() => handleRemoveNoteClick(note.id)}
                      onBlur={() => setPendingRemoveNoteId((current) => (current === note.id ? null : current))}
                    >
                      {pendingRemoveNoteId === note.id ? "confirm?" : "remove"}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/70 whitespace-pre-wrap mt-1">{note.content || "Empty note"}</p>
              </div>
            ))}
            {state.notes.length === 0 && <div className="text-[11px] text-white/55">No notes yet.</div>}
          </div>
        </div>
      )}

      {view === "agenda" && (
        <div className="flex flex-col gap-1.5 min-h-0">
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="Event title..."
            className="bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none"
          />
          <div className="grid grid-cols-2 gap-1">
            <input required value={eventStart} onChange={(e) => setEventStart(e.target.value)} type="datetime-local" className="bg-white/10 text-white text-[11px] rounded px-2 py-1 outline-none" />
            <input required value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} type="datetime-local" className="bg-white/10 text-white text-[11px] rounded px-2 py-1 outline-none" />
          </div>
          <button
            type="button"
            disabled={!eventTitle.trim() || !eventStart || !eventEnd}
            className="px-2 py-1 rounded bg-white/20 text-[11px] text-white self-start disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              const startsAt = Date.parse(eventStart);
              const endsAt = Date.parse(eventEnd);
              if (!eventTitle.trim() || Number.isNaN(startsAt) || Number.isNaN(endsAt) || endsAt <= startsAt) {
                setEventError("Pick a start and end time; end must be after start.");
                return;
              }
              onAddEvent(eventTitle, startsAt, endsAt);
              setEventError("");
              setEventTitle("");
              setEventStart("");
              setEventEnd("");
            }}
          >
            Add event
          </button>
          {eventError && <div className="text-[10px] text-red-300">{eventError}</div>}
          <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
            {state.calendarEvents.map((event) => (
              <div key={event.id} className="bg-white/8 rounded px-2 py-1.5 text-[11px]">
                <div className="text-white/90">{event.title}</div>
                <div className="text-white/60">
                  {new Date(event.startsAt).toLocaleString()} - {new Date(event.endsAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {state.calendarEvents.length === 0 && <div className="text-[11px] text-white/55">No upcoming events.</div>}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-1.5 flex items-center gap-1.5">
        <button type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80" onClick={() => void onExportBackup()}>Export</button>
        <button type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80" onClick={() => void onPreviewImport()}>Preview import</button>
        <button type="button" className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white" onClick={() => void onApplyImport()}>Apply import</button>
      </div>
    </div>
  );
}
