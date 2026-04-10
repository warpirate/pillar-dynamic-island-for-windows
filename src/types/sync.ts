import type { ProductivitySnapshot } from "./productivity";

export interface SyncConflictInfo {
  reason: "version_mismatch" | "stale_remote" | "validation_error";
  message: string;
}

export interface SyncEnvelope {
  schemaVersion: number;
  deviceId: string;
  updatedAt: number;
  snapshot: ProductivitySnapshot;
}

export interface SyncValidationResult {
  valid: boolean;
  conflicts: SyncConflictInfo[];
}
