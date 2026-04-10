export type WorkflowActionId =
  | "toggle_expand"
  | "open_timer_tab"
  | "open_media_tab"
  | "open_notifications_tab"
  | "open_settings_tab"
  | "open_prism_tab"
  | "open_productivity_tab"
  | "quick_add_task";

export interface WorkflowActionEnvelope {
  id: WorkflowActionId;
  args?: Record<string, unknown>;
  source: "tray" | "shortcut" | "ui";
  timestamp: number;
}
