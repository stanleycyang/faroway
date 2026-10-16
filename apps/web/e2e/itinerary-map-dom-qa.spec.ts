import { test, expect } from "@playwright/test";
import { build } from "esbuild";

let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom'; import {ItineraryMap} from './components/trips/ItineraryMap'; const root=createRoot(document.getElementById('root')); window.mountMap=(itinerary)=>flushSync(()=>root.render(React.createElement(ItineraryMap,{itinerary}))); window.unmountMap=()=>flushSync(()=>root.unmount());`,
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
        name: "qa-leaflet-host",
        setup(builder) {
          builder.onResolve({ filter: /^leaflet$/ }, () => ({
            path: "qa-leaflet",
            namespace: "qa",
          }));
          builder.onLoad({ filter: /.*/, namespace: "qa" }, () => ({
            loader: "js",
            contents: `const map={remove(){window.removed=(window.removed||0)+1},invalidateSize(){window.invalidated=(window.invalidated||0)+1},fitBounds(){}}; export default {map(){return map},tileLayer(){return {addTo(){}}},latLngBounds(){return {extend(){}}},divIcon(options){window.icon=options.html;return options},marker(){return {addTo(){return this},bindPopup(label){document.getElementById('popups').append(label);return this}}}};`,
          }));
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
});

test("map renders HTML-looking names as text and cancels resize work on unmount", async ({
  page,
}) => {
  await page.setContent('<div id="root"></div><div id="popups"></div>');
  await page.evaluate(() => {
    const original = window.cancelAnimationFrame;
    window.cancelAnimationFrame = (id) => {
      document.body.dataset.cancelled = "true";
      original(id);
    };
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(
    `mountMap({days:[{dayNumber:1,morning:{activities:[{name:'<img src=x onerror="window.injected=true">',location:{coordinates:{lat:0,lng:0}}}]}}]});unmountMap();`,
  );
  await expect(page.locator("#popups")).toContainText(
    '<img src=x onerror="window.injected=true">',
  );
  await expect(page.locator("#popups img")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-cancelled", "true");
  expect(await page.evaluate("window.injected === true")).toBe(false);
  expect(await page.evaluate("window.removed")).toBe(1);
});

test("map without locations explains how to continue instead of leaving a blank panel", async ({
  page,
}) => {
  await page.setContent('<div id="root"></div><div id="popups"></div>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate("mountMap({days:[]})");
  await expect(page.getByRole("status")).toContainText(
    "Map locations aren’t available",
  );
  await expect(page.getByRole("status")).toContainText("day-by-day plan");
});
