import { runDataBackfills } from './backfills.js';

let runtimeDataReady;

export function ensureRuntimeData() {
  if (!runtimeDataReady) {
    runtimeDataReady = runDataBackfills().catch((error) => {
      runtimeDataReady = undefined;
      throw error;
    });
  }

  return runtimeDataReady;
}
