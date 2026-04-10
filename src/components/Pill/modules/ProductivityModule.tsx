import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { NoteItem, ProductivityState } from "../../../types/productivity";
import { microInteractions } from "../animations";

type ProductivityView = "tasks" | "notes" | "agenda";

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
  const completedCount = useMemo(() => state.tasks.filter((t) => t.completed).length, [state.tasks]);

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
              {id}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-white/60 uppercase">{state.status}</span>
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
              className="px-2 py-1 rounded bg-white/20 text-[11px] text-white"
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
                <button type="button" className="text-[10px] text-white/60 hover:text-white" onClick={() => onRemoveTask(task.id)}>
                  remove
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
            className="bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none"
          />
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Write note..."
            className="bg-white/10 text-white text-[12px] rounded px-2 py-1 outline-none min-h-[64px]"
          />
          <button
            type="button"
            className="px-2 py-1 rounded bg-white/20 text-[11px] text-white self-start"
            onClick={() => {
              onAddNote(noteTitle, noteContent);
              setNoteTitle("");
              setNoteContent("");
            }}
          >
            Save note
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
                      onClick={() => onUpdateNote({ ...note, content: `${note.content}\n` })}
                    >
                      touch
                    </button>
                    <button type="button" className="text-[10px] text-white/60 hover:text-white" onClick={() => onRemoveNote(note.id)}>
                      remove
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
            <input value={eventStart} onChange={(e) => setEventStart(e.target.value)} type="datetime-local" className="bg-white/10 text-white text-[11px] rounded px-2 py-1 outline-none" />
            <input value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} type="datetime-local" className="bg-white/10 text-white text-[11px] rounded px-2 py-1 outline-none" />
          </div>
          <button
            type="button"
            className="px-2 py-1 rounded bg-white/20 text-[11px] text-white self-start"
            onClick={() => {
              const startsAt = Date.parse(eventStart);
              const endsAt = Date.parse(eventEnd);
              onAddEvent(eventTitle, startsAt, endsAt);
              setEventTitle("");
            }}
          >
            Add event
          </button>
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
