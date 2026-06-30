import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { WorkflowActionEnvelope } from "../types/workflows";

export function useWorkflowEvents(onAction: (action: WorkflowActionEnvelope) => void): void {
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    listen<WorkflowActionEnvelope>("workflow-action", (event) => {
      if (disposed) return;
      onActionRef.current(event.payload);
    })
      .then((fn) => {
        if (disposed) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch(() => {
        // no-op in non-tauri or unsupported environment
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
