import path from "node:path";

const result = await Bun.build({
  entrypoints: ["e2e/fixtures/planning.tsx"],
  target: "browser",
  plugins: [
    {
      name: "next-dom-fixture",
      setup(build) {
        // Next's production image/link transforms require its runtime. The isolated
        // fixture keeps their DOM semantics and layout without an app-router server.
        build.onResolve({ filter: /^next\/(image|link)$/ }, (args) => ({
          path: path.resolve(
            `e2e/fixtures/next-${args.path.split("/")[1]}.tsx`,
          ),
        }));
      },
    },
  ],
});
if (!result.success) throw new Error(result.logs.join("\n"));
await Bun.write(process.argv[2], result.outputs[0]);
