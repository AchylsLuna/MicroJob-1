import { runDataBackfills } from './backfills.js';
import { checkObjectIdValidators } from './dataIntegrity.js';

let runtimeDataReady;

export function ensureRuntimeData() {
  if (!runtimeDataReady) {
    runtimeDataReady = runDataBackfills()
      .then(() =>
        // Advisory only: a missing validator means the database is open to the
        // string-_id corruption again, but it is not a reason to refuse traffic.
        checkObjectIdValidators().catch((error) => {
          console.warn(`Could not verify ObjectId validators: ${error?.message || error}`);
        })
      )
      .catch((error) => {
        runtimeDataReady = undefined;
        throw error;
      });
  }

  return runtimeDataReady;
}
