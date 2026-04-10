import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { WorkflowActionEnvelope } from "../types/workflows";

export function useWorkflowEvents(onAction: (action: WorkflowActionEnvelope) => void): void {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let mounted = true;

    listen<WorkflowActionEnvelope>("workflow-action", (event) => {
      if (!mounted) return;
      onAction(event.payload);
    })
      .then((fn) => {
        if (mounted) unlisten = fn;
      })
      .catch(() => {
        // no-op in non-tauri or unsupported environment
      });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [onAction]);
}
