import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { backfillUserTurnCounts } from "../../orchestration-v2/userTurnCount.ts";

// The projector keeps this current on message.updated, so shell reads never count messages.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    ALTER TABLE orchestration_v2_projection_threads
    ADD COLUMN user_turn_count INTEGER NOT NULL DEFAULT 0
  `;
  yield* backfillUserTurnCounts(sql);
});
