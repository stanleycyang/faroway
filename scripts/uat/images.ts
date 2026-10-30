// Audit the entire public catalog; --seed fills missing staging objects only.
import { IMAGE_PATHS } from "../../packages/constants/src/images";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";

const staging = "https://omovikloadpvzijoaqus.supabase.co";
const source = "https://jcnephijkxgtprsutgsf.supabase.co";
const paths = [
  ...new Set(
    Object.values(IMAGE_PATHS).flatMap((group) => Object.values(group)),
  ),
];
const seed = process.argv.includes("--seed");
let client;
if (seed) {
  // Capture credentials in memory; never log them or persist them to disk.
  const keys = JSON.parse(
    execFileSync(
      "bunx",
      [
        "supabase@2.76.15",
        "projects",
        "api-keys",
        "--project-ref",
        "omovikloadpvzijoaqus",
        "-o",
        "json",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );
  const key = keys.find(
    (k: { name: string }) => k.name === "service_role",
  ).api_key;
  client = createClient(staging, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
let failed = 0;
let copied = 0;
async function valid(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(20000),
  });
  return (
    response.ok && response.headers.get("content-type")?.startsWith("image/")
  );
}
for (let offset = 0; offset < paths.length; offset += 4) {
  await Promise.all(
    paths.slice(offset, offset + 4).map(async (path) => {
      const suffix = "/storage/v1/object/public/images/" + path;
      try {
        if (await valid(staging + suffix)) return;
        if (!client) throw new Error("Missing staging image");
        const response = await fetch(source + suffix, {
          signal: AbortSignal.timeout(30000),
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.startsWith("image/")
        )
          throw new Error("Source image unavailable");
        const { error } = await client.storage
          .from("images")
          .upload(path, await response.arrayBuffer(), {
            contentType: response.headers.get("content-type")!,
            cacheControl: "3600",
            upsert: false,
          });
        if (error) throw new Error("Upload failed: " + error.message);
        if (!(await valid(staging + suffix)))
          throw new Error("Public retrieval failed after upload");
        copied++;
      } catch (error) {
        failed++;
        console.error(path + ": " + (error as Error).message);
      }
    }),
  );
}
console.log(JSON.stringify({ catalogImages: paths.length, copied, failed }));
process.exitCode = failed ? 1 : 0;
