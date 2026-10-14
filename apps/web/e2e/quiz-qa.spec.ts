import { test, expect } from "@playwright/test";
import { quizQuestions } from "../lib/tools/quiz-questions";

test("quiz keeps keyboard focus, lets travelers revise answers, and hands its match into planning", async ({
  page,
}) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route("**/_next/image?*", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/tools/travel-quiz");
  await page.getByRole("button", { name: "Take the Quiz" }).click();
  await expect(
    page.getByRole("heading", { name: quizQuestions[0].question, exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", {
      name: quizQuestions[0].options[0].label,
      exact: false,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: quizQuestions[1].question, exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Previous question" }).click();
  await expect(
    page.getByRole("heading", { name: quizQuestions[0].question, exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", {
      name: quizQuestions[0].options[0].label,
      exact: false,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const [index, question] of quizQuestions.entries()) {
    await expect(
      page.getByRole("progressbar", { name: "Quiz progress" }),
    ).toHaveAttribute("aria-valuenow", String(index + 1));
    if (question.multiSelect) {
      await expect(
        page.getByRole("button", { name: "Continue", exact: true }),
      ).toBeDisabled();
      for (const option of question.options.slice(0, 3)) {
        await page
          .getByRole("button", { name: option.label, exact: false })
          .click();
      }
      await expect(
        page.getByText("3/3 selected", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    } else {
      await page
        .getByRole("button", { name: question.options[0].label, exact: false })
        .click();
    }
  }
  await expect(
    page.getByRole("heading", { name: "Your Perfect Destinations" }),
  ).toBeFocused();
  const plan = page.getByRole("link", { name: /^Plan My .* Trip$/ }).first();
  await expect(plan).toBeVisible();
  const handoff = await plan.getAttribute("href");
  expect(
    new URL(handoff!, page.url()).searchParams.get("destination"),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Retake Quiz" }).click();
  await expect(
    page.getByRole("heading", { name: "Where Should You Go?" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Take the Quiz" }).click();
  await expect(
    page.getByRole("button", {
      name: quizQuestions[0].options[0].label,
      exact: false,
    }),
  ).toHaveAttribute("aria-pressed", "false");
});
