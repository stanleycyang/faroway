// Real route modules in an isolated Next app with in-memory blog rows.
// No .env, production config, instrumentation or providers are copied.
// Usage: node scripts/check-blog-http-offline.mjs [--baseline] [--production]
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtemp,
  mkdir,
  cp,
  writeFile,
  appendFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const require = createRequire(import.meta.url);
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(tmpdir(), "faroway-blog-http-"));
const baseline = process.argv.includes("--baseline");
const production = process.argv.includes("--production");
let server;
let log = "";
const results = [];
const copy = async (relative) => {
  await mkdir(path.dirname(path.join(fixture, relative)), { recursive: true });
  await cp(path.join(web, relative), path.join(fixture, relative), {
    recursive: true,
  });
};
const write = (relative, data) => writeFile(path.join(fixture, relative), data);

try {
  for (const relative of [
    "app/blog",
    "app/destinations",
    "app/sitemap.ts",
    "app/not-found.tsx",
    "components/blog",
    "components/landing/FadeInOnScroll.tsx",
    "components/Header.tsx",
    "components/Footer.tsx",
    "components/Logo.tsx",
    "components/AppStoreButtons.tsx",
    "components/GoBackButton.tsx",
    "components/ResilientImage.tsx",
    "hooks/useInView.ts",
    "hooks/useReducedMotion.ts",
    "hooks/useHydrated.ts",
    "lib/blog",
    "lib/destination-guides.ts",
    "lib/store-links.ts",
    "lib/tools/cost-data.ts",
  ])
    await copy(relative);
  await rm(path.join(fixture, "app/blog/[slug]/opengraph-image.tsx"));
  await rm(path.join(fixture, "app/destinations/[slug]/opengraph-image.tsx"));
  await rm(path.join(fixture, "app/destinations/page.tsx"));
  await cp(
    path.resolve(web, "../../packages/constants/src"),
    path.join(fixture, "constants"),
    { recursive: true },
  );
  await symlink(
    path.dirname(path.dirname(require.resolve("next/package.json"))),
    path.join(fixture, "node_modules"),
    "dir",
  );
  await write(
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
  await write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "esnext"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "react-jsx",
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./*"],
          "@faroway/constants": ["./constants/index.ts"],
          "@sentry/nextjs": ["./sentry.ts"],
        },
      },
      include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    }),
  );
  await write("next.config.mjs", "export default { devIndicators: false };\n");
  await write(
    "sentry.ts",
    "export function captureException(..._args: unknown[]) {}\n",
  );
  await write(
    "app/layout.tsx",
    `export const dynamic = "force-dynamic";
    export const metadata = { metadataBase: new URL("https://www.faroway.ai") };
    export default function Layout({children}: {children: React.ReactNode}) {
    return <html><body><div id="main-content">{children}</div></body></html>;
  }`,
  );
  await write(
    "app/page.tsx",
    "export default function Page() { return <p>Fixture ready</p>; }",
  );
  // Exercise cold renders, not a previously built healthy ISR response.
  await appendFile(
    path.join(fixture, "app/sitemap.ts"),
    '\nexport const dynamic = "force-dynamic";\n',
  );
  await write("mode.txt", "failed");
  await write(
    "lib/blog/supabase.ts",
    `import { readFile } from "node:fs/promises";
    const rows = Array.from({ length: 20 }, (_, i) => ({
      slug: 'post-' + i, title: 'Fixture story ' + i, description: 'Travel & food',
      category: i === 19 ? 'Long Tail' : 'Travel Tips', tags: [],
      published_at: '2026-10-01T00:00:00Z', featured: i === 5,
      content: '## Fixture article\\nLocal article context survives.',
    }));
    export function getBlogSupabase() {
      return { from: (_table: string) => {
        let slug: string | undefined;
        const result = async <T,>(data: T) => {
          await new Promise(resolve => setTimeout(resolve, 80));
          const mode = (await readFile('mode.txt', 'utf8')).trim();
          const failed = mode === 'failed' || (mode === 'related-failed' && slug === undefined);
          return { data: failed || slug === 'backend-error' ? null : data,
            error: failed || slug === 'backend-error' ? { code: '503' } : null };
        };
        const query = {
          select: (_columns: string) => query, eq: (key: string, value: string) => { if (key === 'slug') slug = value; return query; },
          order: (_column: string, _options: unknown) => query, limit: (n: number) => result(rows.slice(0, n)),
          range: (from: number, to: number) => result(rows.slice(from, to + 1)),
          maybeSingle: () => result(rows.find(row => row.slug === slug) || null),
        };
        return query;
      }};
    }`,
  );
  // Allowlist environment variables; never inherit credentials.
  const env = {
    PATH: process.env.PATH,
    HOME: fixture,
    TMPDIR: tmpdir(),
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_BASE_URL: "https://www.faroway.ai",
  };
  if (production) {
    await write("mode.txt", "healthy");
    const build = spawn(
      process.execPath,
      [require.resolve("next/dist/bin/next"), "build", "--webpack"],
      { cwd: fixture, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    for (const stream of [build.stdout, build.stderr])
      stream.on("data", (data) => {
        log += data;
      });
    assert.equal(
      await new Promise((resolve) => build.once("exit", resolve)),
      0,
      "offline production fixture build",
    );
    await rm(path.join(fixture, ".next/cache"), {
      recursive: true,
      force: true,
    });
    await write("mode.txt", "failed");
  }
  const reservation = net.createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  server = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      ...(production ? ["start"] : ["dev", "--webpack"]),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: fixture, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (data) => {
      log += data;
    });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) break;
    } catch {}
    if (i >= 60 || server.exitCode !== null)
      throw new Error("Fixture server did not start");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const check = async (url, status, agent = "Mozilla/5.0") => {
    const response = await fetch(origin + url, {
      headers: { "user-agent": agent },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.text();
    results.push({ url, agent, expected: status, actual: response.status });
    if (!baseline) assert.equal(response.status, status, `${agent} ${url}`);
    return body;
  };
  for (const url of [
    "/blog",
    "/blog/category/travel-tips",
    "/blog/guides",
    "/blog/guides/budget-travel",
    "/blog/post-1",
    "/blog/feed.xml",
    "/sitemap.xml",
  ])
    await check(url, 500);
  await write("mode.txt", "related-failed");
  await check("/blog/post-2", 500);
  await write("mode.txt", "healthy");
  for (const agent of ["Mozilla/5.0", "Googlebot", "Twitterbot"]) {
    for (const url of [
      "/blog/missing",
      "/blog/category/missing",
      "/blog/guides/missing",
      "/destinations/missing",
      "/blog?page=999",
      "/blog?page=2abc",
      "/blog?page=0",
      "/blog?page=1&page=2",
      "/blog/category/travel-tips?page=999",
    ])
      await check(url, 404, agent);
    await check("/blog/backend-error", 500, agent);
  }
  const first = await check("/blog", 200);
  const second = await check("/blog?page=2", 200);
  const third = await check("/blog?page=3", 200);
  await check("/blog/category/long-tail", 200);
  const article = await check("/blog/post-19", 200);
  const destination = await check("/destinations/tokyo", 200);
  const rss = await check("/blog/feed.xml", 200);
  const map = await check("/sitemap.xml", 200);
  if (!baseline) {
    const slugs = [first, second, third].flatMap((html) =>
      [
        ...html.matchAll(/<article[^>]*>\s*<a[^>]*href="\/blog\/(post-\d+)"/g),
      ].map((match) => match[1]),
    );
    assert.equal(
      slugs.length,
      20,
      "all articles appear exactly once across index pages",
    );
    assert.equal(
      new Set(slugs).size,
      20,
      "no duplicate articles across index pages",
    );
    assert.match(
      second,
      /rel="canonical" href="https:\/\/www.faroway.ai\/blog\?page=2"/,
    );
    assert.match(article, /Local article context survives/);
    assert.match(article, /\/blog\/category\/long-tail/);
    assert.match(article, /journal-cover.svg/);
    assert.match(destination, /\/create\?destination=Tokyo/);
    assert.equal((rss.match(/<item>/g) || []).length, 20);
    assert.match(map, /\/blog\/category\/long-tail/);
  }
  console.log(
    JSON.stringify(
      {
        mode: baseline ? "baseline" : "repaired",
        runtime: production ? "production" : "development",
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify(results, null, 2));
  console.error(log.slice(-12000));
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await rm(fixture, { recursive: true, force: true });
}
