import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { build } from "esbuild";
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Shared from './app/s/error'; import Private from './app/(app)/trips/error'; import Global from './app/error'; import Root from './app/global-error'; const views={shared:Shared,private:Private,global:Global,root:Root}; window.mountRecovery=(kind)=>createRoot(kind==='root'?document:document.getElementById('root')).render(React.createElement(views[kind],{error:new Error('private-diagnostic-marker'),reset:()=>{window.resets=(window.resets||0)+1}}));`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "recovery-host",
        setup(builder) {
          builder.onResolve(
            { filter: /^(next\/link|@sentry\/nextjs)$/ },
            (args) => ({ path: args.path, namespace: "qa" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "qa" }, (args) => ({
            loader: "js",
            resolveDir: process.cwd(),
            contents:
              args.path === "next/link"
                ? `import React from 'react'; export default function Link(props){return React.createElement('a',props);}`
                : `export function captureException(){}`,
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
});
for (const [kind, title, destination] of [
  ["shared", "This itinerary is taking a moment", "/support"],
  ["private", "Your trip couldn’t load", "/dashboard"],
  ["global", "This page couldn’t load", "/"],
  ["root", "This page couldn’t load", "/"],
]) {
  test(`${kind} recovery focuses its heading, retries once, and offers a usable exit`, async ({
    page,
  }, testInfo) => {
    if (kind === "root")
      await page.setViewportSize({ width: 320, height: 568 });
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: bundle });
    await page.evaluate(`mountRecovery('${kind}')`);
    await expect(page.getByRole("heading", { name: title })).toBeFocused();
    await expect(page.locator("body")).not.toContainText(
      "private-diagnostic-marker",
    );
    await expect(page.locator(`a[href="${destination}"]`)).toBeVisible();
    await page.getByRole("button", { name: /try again/i }).click();
    expect(await page.evaluate("window.resets")).toBe(1);
    if (kind === "root") {
      expect(await page.evaluate(() => innerWidth)).toBe(320);
      await expect(
        page.getByRole("button", { name: "Try again", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (testInfo.project.name === "Mobile Chrome") {
        const path =
          "../../artifacts/full-flow-ux-qa-2026-10-13/root-recovery-phone.png";
        await mkdir(dirname(path), { recursive: true });
        await page.screenshot({ path });
      }
    }
  });
}
