import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
let bundle: string;
let stylesheet: string;
test.beforeAll(async () => {
  stylesheet = await readFile(
    path.resolve(process.cwd(), "../../node_modules/leaflet/dist/leaflet.css"),
    "utf8",
  );
  const result = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {ItineraryMap} from './components/trips/ItineraryMap';const root=createRoot(document.getElementById('root'));window.mountMap=(itinerary)=>flushSync(()=>root.render(React.createElement(ItineraryMap,{itinerary,className:'qa-map'})));window.unmountMap=()=>flushSync(()=>root.unmount());`,
      loader: "tsx",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  bundle = result.outputFiles[0].text;
});
test("real Leaflet plots zero-coordinate stops, literal popups and visible credit then recovers from missing locations", async ({
  page,
}) => {
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({
    content:
      stylesheet +
      ".qa-map{height:320px;width:100%}.h-full{height:100%}.w-full{width:100%}",
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    `mountMap({days:[{dayNumber:1,morning:{activities:[{name:'<img src=x onerror="window.injected=true">',location:{coordinates:{lat:0,lng:0}}},{name:'Prime meridian stop',location:{coordinates:{lat:51,lng:0}}}]}}]})`,
  );
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(2);
  await expect(
    page
      .locator(".leaflet-control-attribution")
      .getByRole("link", { name: "OpenStreetMap" }),
  ).toBeVisible();
  await page.locator(".leaflet-marker-icon").first().click();
  await expect(page.locator(".leaflet-popup-content")).toContainText(
    '<img src=x onerror="window.injected=true">',
  );
  await expect(page.locator(".leaflet-popup-content img")).toHaveCount(0);
  expect(await page.evaluate("window.injected === true")).toBe(false);
  await page.evaluate("mountMap({days:[]})");
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Map locations aren’t available",
  );
  await page.evaluate("unmountMap()");
  await expect(page.locator("#root")).toBeEmpty();
});
