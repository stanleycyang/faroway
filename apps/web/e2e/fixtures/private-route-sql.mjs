// QA-only adapter into a named, network-isolated disposable PostgreSQL substrate.
import { execFileSync } from "node:child_process";
const container = "faroway-ux-transactions-qa";
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
function execute(statement, admin = false) {
  const output = execFileSync(
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
  return output ? JSON.parse(output) : null;
}
export function createPrivateSqlStore(template) {
  const state = JSON.parse(
    execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
  )[0];
  if (
    !state.State.Running ||
    state.HostConfig.NetworkMode !== "none" ||
    Object.keys(state.HostConfig.PortBindings || {}).length ||
    state.Config.Labels["faroway.qa"] !== "full-flow-ux-2026-10-13"
  )
    throw new Error("Disposable SQL fixture isolation not verified");
  const owner = template.user_id,
    id = template.id;
  const scoped = `id=${literal(id)}::uuid AND user_id=${literal(owner)}::uuid`;
  return {
    reset() {
      execute(
        `BEGIN; DELETE FROM public.trips WHERE id=${literal(id)}::uuid;
INSERT INTO public.trips(id,user_id,destination,start_date,end_date,status,preferences,is_shared,share_token,updated_at) VALUES(${literal(id)}::uuid,${literal(owner)}::uuid,${literal(template.destination)},${literal(template.start_date)}::date,${literal(template.end_date)}::date,'planned','{}',FALSE,NULL,${literal(template.updated_at)}::timestamptz);
INSERT INTO public.itineraries(trip_id,user_id,days,overview,generated_at) VALUES(${literal(id)}::uuid,${literal(owner)}::uuid,${json(template.itineraries[0].days)},${literal(template.itineraries[0].overview)},${literal(template.itineraries[0].generated_at)}::timestamptz); COMMIT;`,
        true,
      );
    },
    trip() {
      const row = execute(
        `SELECT to_jsonb(t)||jsonb_build_object('itineraries',(SELECT jsonb_agg(to_jsonb(i)) FROM public.itineraries i WHERE i.trip_id=t.id)) FROM public.trips t WHERE ${scoped};`,
      );
      return row
        ? {
            ...structuredClone(template),
            ...row,
            itineraries: row.itineraries.map((i) => ({
              ...template.itineraries[0],
              ...i,
            })),
          }
        : null;
    },
    history() {
      return execute(
        `SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY created_at DESC),'[]') FROM public.trip_plan_revisions r WHERE trip_id=${literal(id)}::uuid AND user_id=${literal(owner)}::uuid;`,
      );
    },
    patch(patch) {
      execute(
        `UPDATE public.trips SET is_shared=${patch.is_shared ? "TRUE" : "FALSE"},share_token=${patch.share_token === null ? "NULL" : literal(patch.share_token)},shared_at=${patch.shared_at === null ? "NULL" : literal(patch.shared_at) + "::timestamptz"},updated_at=${literal(patch.updated_at)}::timestamptz WHERE ${scoped};`,
      );
    },
    rpc(name, args) {
      if (args.p_trip_id !== id || args.p_user_id !== owner)
        throw new Error("Fixture RPC owner mismatch");
      const head = `${literal(id)}::uuid,${literal(owner)}::uuid`;
      if (name === "update_trip_brief") {
        const row = execute(
          `SELECT to_jsonb(t) FROM public.update_trip_brief(${head},${literal(args.p_expected_updated_at)}::timestamptz,${json(args.p_changes)}) t;`,
        );
        return row ? { ...structuredClone(template), ...row } : null;
      }
      if (name === "edit_trip_plan")
        return execute(
          `SELECT public.edit_trip_plan(${head},${json(args.p_command)},${json(args.p_days)},ARRAY[${args.p_locked.map(literal).join(",")}]::text[]);`,
        );
      if (name === "report_trip_booking")
        return execute(
          `SELECT public.report_trip_booking(${head},${json(args.p_command)});`,
        );
      if (name === "read_trip_booking_reports")
        return execute(
          `SELECT public.read_trip_booking_reports(${head},${args.p_request_id ? literal(args.p_request_id) + "::uuid" : "NULL"});`,
        );
      throw new Error("Unsupported fixture RPC");
    },
  };
}
