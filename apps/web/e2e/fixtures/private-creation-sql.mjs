// Dedicated QA adapter: the complete schema in a verified disposable database.
import { execFileSync } from "node:child_process";
const container = "faroway-ux-full-schema-qa";
const owner = "11111111-1111-4111-8111-111111111111";
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;

export function createPrivateCreationStore() {
  const state = JSON.parse(
    execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
  )[0];
  if (
    !state.State.Running ||
    state.HostConfig.NetworkMode !== "none" ||
    Object.keys(state.HostConfig.PortBindings || {}).length ||
    state.Config.Labels["faroway.qa"] !== "full-schema"
  )
    throw new Error("Full-schema disposable fixture isolation not verified");
  function execute(statement, admin = false) {
    const value = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: `${admin ? "" : "SET ROLE service_role;"} ${statement}`,
        encoding: "utf8",
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();
    return value ? JSON.parse(value) : null;
  }
  return {
    reset() {
      execute(
        `BEGIN; DELETE FROM public.trips WHERE user_id=${literal(owner)}::uuid;
DELETE FROM public.trip_creation_requests WHERE user_id=${literal(owner)}::uuid;
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) VALUES(${literal(owner)}::uuid,'authenticated','authenticated','qa@example.invalid','{}','{}',now(),now()) ON CONFLICT(id) DO NOTHING; COMMIT;`,
        true,
      );
    },
    read(id) {
      if (id && !/^[0-9a-f-]{36}$/.test(id)) return null;
      const rows = execute(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t)||jsonb_build_object('itineraries',COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM public.itineraries i WHERE i.trip_id=t.id),'[]'))),'[]') FROM public.trips t WHERE user_id=${literal(owner)}::uuid ${id ? `AND id=${literal(id)}::uuid` : ""};`,
      );
      return id ? (rows[0] ?? null) : rows;
    },
    rpc(name, args) {
      if (args.p_user_id !== owner)
        throw new Error("Creation fixture owner mismatch");
      if (name === "create_trip_once")
        return execute(
          `SELECT public.create_trip_once(${literal(owner)}::uuid,${literal(args.p_request_key)},${json(args.p_input)});`,
        );
      if (
        name === "update_trip_brief" &&
        /^[0-9a-f-]{36}$/.test(args.p_trip_id)
      )
        return execute(
          `SELECT to_jsonb(t) FROM public.update_trip_brief(${literal(args.p_trip_id)}::uuid,${literal(owner)}::uuid,${literal(args.p_expected_updated_at)}::timestamptz,${json(args.p_changes)}) t;`,
        );
      throw new Error("Unsupported creation fixture RPC");
    },
  };
}
