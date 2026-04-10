use serde::{Deserialize, Serialize};

pub const PRODUCTIVITY_BACKUP_SCHEMA: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConflictInfo {
    pub reason: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncValidationResult {
    pub valid: bool,
    pub conflicts: Vec<SyncConflictInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductivitySnapshotEnvelope {
    pub schema_version: u32,
    pub exported_at: u64,
    pub state: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportBackupResult {
    pub validation: SyncValidationResult,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot: Option<ProductivitySnapshotEnvelope>,
}

pub trait SyncAdapter {
    fn validate_snapshot(&self, snapshot: &ProductivitySnapshotEnvelope) -> SyncValidationResult;
}

pub struct StubSyncAdapter;

impl SyncAdapter for StubSyncAdapter {
    fn validate_snapshot(&self, snapshot: &ProductivitySnapshotEnvelope) -> SyncValidationResult {
        if snapshot.schema_version != PRODUCTIVITY_BACKUP_SCHEMA {
            return SyncValidationResult {
                valid: false,
                conflicts: vec![SyncConflictInfo {
                    reason: "version_mismatch".to_string(),
                    message: format!(
                        "Unsupported schema version {} (expected {}).",
                        snapshot.schema_version, PRODUCTIVITY_BACKUP_SCHEMA
                    ),
                }],
            };
        }

        SyncValidationResult {
            valid: true,
            conflicts: vec![],
        }
    }
}
