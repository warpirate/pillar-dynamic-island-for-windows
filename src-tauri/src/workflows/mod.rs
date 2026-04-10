use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowActionId {
    ToggleExpand,
    OpenTimerTab,
    OpenMediaTab,
    OpenNotificationsTab,
    OpenSettingsTab,
    OpenPrismTab,
    OpenProductivityTab,
    QuickAddTask,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowActionEnvelope {
    pub id: WorkflowActionId,
    #[serde(default)]
    pub args: Option<serde_json::Value>,
    pub source: String,
    pub timestamp: u64,
}

pub fn emit_action(
    app_handle: &tauri::AppHandle,
    id: WorkflowActionId,
    source: &str,
    args: Option<serde_json::Value>,
) {
    let envelope = WorkflowActionEnvelope {
        id,
        args,
        source: source.to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    };
    let _ = app_handle.emit("workflow-action", envelope);
}
