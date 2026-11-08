import {
  IDLE_COMPACTION_TEXT,
  idleCompactionOf,
  type OrchestrationV2ConversationMessage,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import type * as SqlClient from "effect/sql/SqlClient";

/** Mirrors idleCompactionOf, including JavaScript trim whitespace. */
export const idleCompactionMessageSql = (sql: SqlClient.SqlClient, alias: string) => {
  const payload = sql.literal(`${alias}.payload_json`);
  return sql`(
    ${sql.literal(`${alias}.role`)} = 'user'
    AND lower(trim(json_extract(${payload}, '$.text'),
      char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195,
        8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279)
    )) = ${IDLE_COMPACTION_TEXT}
    AND coalesce(json_array_length(${payload}, '$.attachments'), 0) = 0
    AND (
      json_extract(${payload}, '$.idleCompaction') IS NOT NULL
      OR (
        json_extract(${payload}, '$.createdBy') = 'agent'
        AND json_extract(${payload}, '$.creationSource') = 'server'
      )
    )
  )`;
};

/** Mirrors countsAsUserTurn. */
export const userTurnMessageSql = (sql: SqlClient.SqlClient, alias: string) => sql`(
  ${sql.literal(`${alias}.role`)} = 'user'
  AND json_extract(${sql.literal(`${alias}.payload_json`)}, '$.createdBy') = 'user'
  AND NOT ${idleCompactionMessageSql(sql, alias)}
)`;

export const countsAsUserTurn = (message: OrchestrationV2ConversationMessage): boolean =>
  message.role === "user" &&
  message.createdBy === "user" &&
  idleCompactionOf(message) === undefined;

export const backfillUserTurnCounts = Effect.fn("ProjectionStore.backfillUserTurnCounts")(
  function* (sql: SqlClient.SqlClient) {
    yield* sql`
      UPDATE orchestration_v2_projection_threads
      SET user_turn_count = (
        SELECT COUNT(*) FROM orchestration_v2_projection_messages message
        WHERE message.thread_id = orchestration_v2_projection_threads.thread_id
          AND ${userTurnMessageSql(sql, "message")}
      )
    `;
  },
);
