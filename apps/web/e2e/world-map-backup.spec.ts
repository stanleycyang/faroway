import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("editor notes survive download and restore while oversized uploads are rejected", async ({
  page,
}) => {
  const notes = "A wonderful travel memory 🌍\n".repeat(250);
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem(
      "wm:app-state",
      JSON.stringify({
        version: 2,
        state: {
          schemaVersion: 2,
          activeProfileId: "test-traveler",
          settings: {},
          profiles: [
            {
              id: "test-traveler",
              name: "Traveler",
              createdAt: now,
              updatedAt: now,
              visits: { JPN: { iso: "JPN", status: "visited" } },
            },
          ],
        },
      }),
    );
  });
  await page.goto("/tools/world-map");
  await page
    .getByRole("button", { name: "Search countries (keyboard shortcut slash)" })
    .click();
  await page
    .getByRole("searchbox", { name: "Search countries", exact: true })
    .fill("Japan");
  await page
    .locator("#country-search-results")
    .getByRole("button", { name: /Japan/ })
    .click();
  await expect(page.getByRole("heading", { name: /Japan/ })).toBeVisible();
  await page.getByRole("button", { name: "Optional details" }).click();
  await page.getByRole("textbox", { name: "Notes", exact: true }).fill(notes);
  await page.getByRole("button", { name: "Save details" }).click();

  await page.getByRole("button", { name: "Share and export" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download backup/ }).click();
  const download = await downloading;
  const backup = await readFile((await download.path())!);
  expect(JSON.parse(backup.toString()).profiles[0].visits.JPN.notes).toBe(
    notes,
  );

  await page.getByRole("button", { name: "Share and export" }).click();
  await page.getByRole("button", { name: /Restore from backup/ }).click();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "oversized.json",
    mimeType: "application/json",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText("Backup files must be 5 MB or smaller."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replace current" }),
  ).not.toBeVisible();

  await input.setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(page.getByText("Backup contains 1 profile.")).toBeVisible();
  await page.getByRole("button", { name: "Replace current" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("wm:app-state")!).state.profiles[0]
          .visits.JPN.notes,
    ),
  ).toBe(notes);
});
