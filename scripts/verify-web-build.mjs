// Compile the normal production app against an empty, read-only local catalog.
// This artifact is verification-only and must never be promoted or deployed.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

for (const directory of ["../", "../apps/web/"]) {
  for (const filename of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ]) {
    if (existsSync(new URL(directory + filename, import.meta.url))) {
      throw new Error(
        "Build verification requires a worktree without dotenv files",
      );
    }
  }
}

let unexpectedRequests = 0;
const catalog = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const readable = ["/rest/v1/blog_posts", "/rest/v1/destinations"];
  const allowed =
    ["GET", "HEAD"].includes(request.method) && readable.includes(pathname);
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (!allowed) {
    unexpectedRequests++;
    console.error(`Build fixture rejected ${request.method} ${pathname}`);
    response.writeHead(503);
    response.end(
      JSON.stringify({ message: "Unsupported build fixture request" }),
    );
    return;
  }
  response.setHeader("Content-Range", "*/0");
  response.end("[]");
});

await new Promise((resolve, reject) => {
  catalog.once("error", reject);
  catalog.listen(0, "127.0.0.1", resolve);
});
const address = catalog.address();
let child;
const stop = () => child?.kill("SIGTERM");
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  const url = `http://127.0.0.1:${address.port}`;
  child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/next/dist/bin/next", import.meta.url),
      ),
      "build",
    ],
    {
      cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
      stdio: "inherit",
      // Deliberately do not inherit application credentials or provider settings.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        CI: process.env.CI,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
        NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:4400",
      },
    },
  );
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (status) => resolve(status ?? 1));
  });
  process.exitCode = unexpectedRequests ? 1 : code;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  catalog.closeAllConnections();
  await new Promise((resolve) => catalog.close(resolve));
}
