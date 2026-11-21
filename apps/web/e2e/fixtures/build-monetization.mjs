import path from "node:path";

const entry = process.argv[2];
const outfile = process.argv[3];
if (!entry || !outfile) {
  throw new Error(
    "Usage: bun run e2e/fixtures/build-monetization.mjs <entry.tsx> <outfile.js>",
  );
}

const result = await Bun.build({
  entrypoints: [entry],
  target: "browser",
  plugins: [
    {
      name: "next-dom-fixture",
      setup(build) {
        build.onResolve({ filter: /^next\/(image|link)$/ }, (args) => ({
          path: path.resolve(
            `e2e/fixtures/next-${args.path.split("/")[1]}.tsx`,
          ),
        }));
      },
    },
  ],
});

if (!result.success) {
  throw new Error(result.logs.map((log) => log.message).join("\n"));
}

await Bun.write(outfile, result.outputs[0]);
