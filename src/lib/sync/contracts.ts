import type { SyncEnvelope, SyncValidationResult } from "../../types/sync";

export interface SyncAdapter {
  pullLatest: () => Promise<SyncEnvelope | null>;
  pushLatest: (envelope: SyncEnvelope) => Promise<SyncValidationResult>;
}

export class StubSyncAdapter implements SyncAdapter {
  async pullLatest(): Promise<SyncEnvelope | null> {
    return null;
  }

  async pushLatest(): Promise<SyncValidationResult> {
    return {
      valid: true,
      conflicts: [],
    };
  }
}
