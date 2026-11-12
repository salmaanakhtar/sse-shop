import { expect, test } from "@playwright/test";

test("home page renders the catalog without page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/sse-shop/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Considered goods, delivered across the UAE.",
  );
  await expect(page.getByRole("link", { name: /Essential Tee/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("an unknown path returns 404", async ({ page }) => {
  const response = await page.goto("/this-path-does-not-exist");
  expect(response?.status()).toBe(404);
});
