import { assert, it } from "@effect/vitest";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";

const layer = it.layer(NodeSqliteClient.layer({ filename: ":memory:" }));
const createdAt = "2026-09-01T00:00:00.000Z";

layer("082_ProjectionThreadsUserTurnCount", (it) => {
  it.effect("backfills the user turn count each thread already has", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 81 });
      for (const id of ["counted", "empty"]) {
        yield* sql`
          INSERT INTO orchestration_v2_projection_threads (
            thread_id, project_id, title, default_provider, runtime_mode, interaction_mode,
            created_at, updated_at, payload_json
          ) VALUES (
            ${id}, 'project-1', ${id}, 'codex', 'full-access', 'default',
            ${createdAt}, ${createdAt}, '{}'
          )
        `;
      }
      const messages: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
        ["user-1", "user", { createdBy: "user", text: "Fix it" }],
        ["user-2", "user", { createdBy: "user", text: "/compact" }],
        ["assistant", "assistant", { createdBy: "agent", text: "Done" }],
        ["wake", "user", { createdBy: "agent", text: "Wake up" }],
        ["idle", "user", { createdBy: "user", text: " /compact ", idleCompaction: "onReturn" }],
      ];
      for (const [id, role, payload] of messages) {
        yield* sql`
          INSERT INTO orchestration_v2_projection_messages (
            message_id, thread_id, run_id, node_id, role, streaming,
            created_at, updated_at, payload_json
          ) VALUES (
            ${id}, 'counted', NULL, NULL, ${role}, 0, ${createdAt}, ${createdAt},
            ${JSON.stringify({ ...payload, attachments: [] })}
          )
        `;
      }

      yield* runMigrations({ toMigrationInclusive: 82 });
      assert.deepStrictEqual(
        yield* sql`
          SELECT thread_id, user_turn_count FROM orchestration_v2_projection_threads
          ORDER BY thread_id
        `,
        [
          { thread_id: "counted", user_turn_count: 2 },
          { thread_id: "empty", user_turn_count: 0 },
        ],
      );
    }),
  );
});
