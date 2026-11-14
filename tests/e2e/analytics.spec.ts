import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

test("the analytics dashboard renders first-party event data", async ({ page }) => {
  const beacon = await page.request.post("/api/analytics/view", {
    data: { path: "/products/essential-tee" },
  });
  expect(beacon.status()).toBe(204);

  const badBeacon = await page.request.post("/api/analytics/view", {
    data: { path: "//evil.example" },
  });
  expect(badBeacon.status()).toBe(400);

  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue by day" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top products" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Most viewed pages" })).toBeVisible();
  await expect(page.getByText("First-party events in Postgres.")).toBeVisible();

  await page.getByRole("link", { name: "90 days" }).click();
  await expect(page).toHaveURL(/\/admin\/analytics\?days=90$/);
});
