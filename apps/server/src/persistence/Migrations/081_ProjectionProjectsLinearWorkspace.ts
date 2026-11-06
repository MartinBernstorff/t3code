import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// Null means the project has no Linear workspace; linked issues show as plain text.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`ALTER TABLE projection_projects ADD COLUMN linear_workspace_slug TEXT`;
});
