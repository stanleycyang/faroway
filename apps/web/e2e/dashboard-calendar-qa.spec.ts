import { test, expect } from "@playwright/test";
import { build } from "esbuild";
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {hydrateRoot} from 'react-dom/client'; import {renderToString} from 'react-dom/server'; import {DashboardTripList} from './components/dashboard/DashboardTripList'; const view=React.createElement(DashboardTripList,{trips:[{id:'trip',destination:'Your Kyoto journey',start_date:'2026-10-13',end_date:'2026-10-13',travelers:1}],filter:'past',sort:'date-desc',serverDay:'2026-10-14'}); window.hydrateDashboard=()=>{const root=document.getElementById('root');root.innerHTML=renderToString(view);hydrateRoot(root,view)};`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"development"',
      "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
      "process.env.EXPO_PUBLIC_SUPABASE_URL": '""',
    },
    plugins: [
      {
        name: "dashboard-host",
        setup(builder) {
          builder.onResolve(
            { filter: /^(next\/link|next\/navigation|next\/image)$/ },
            (args) => ({ path: args.path, namespace: "qa" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "qa" }, (args) => ({
            loader: "js",
            resolveDir: process.cwd(),
            contents:
              args.path === "next/image"
                ? `export default function Image(){return null}`
                : args.path === "next/link"
                  ? `import React from 'react'; export default function Link(props){return React.createElement('a',props)}`
                  : `export function useRouter(){return {push(){}}};export function useSearchParams(){return new URLSearchParams()}`,
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
});
for (const timezoneId of ["America/Los_Angeles", "Asia/Tokyo"]) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });
    test("calendar filters hydrate without mismatch and follow local midnight", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (/hydration|didn't match/i.test(message.text()))
          errors.push(message.text());
      });
      await page.clock.install({ time: new Date("2026-10-14T00:30:00Z") });
      await page.setContent(
        '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>',
      );
      await page.addScriptTag({ content: bundle });
      await page.evaluate("hydrateDashboard()");
      if (timezoneId === "America/Los_Angeles") {
        await expect(
          page.getByRole("heading", { name: "No past trips" }),
        ).toBeVisible();
        await expect(
          page.getByText("Your Kyoto journey", { exact: true }),
        ).toHaveCount(0);
        await page.clock.runFor(7 * 60 * 60 * 1000);
      }
      await expect(
        page.getByText("Your Kyoto journey", { exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
