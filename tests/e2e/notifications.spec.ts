import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

test("a sold-out item captures a stock alert and clears it after restock", async ({
  page,
  browser,
}) => {
  const shopper = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const shop = await shopper.newPage();

  await shop.goto("/products/sold-out-tote");
  await expect(shop.getByText("Email me when it's back")).toBeVisible();
  await shop.getByRole("textbox", { name: "Email" }).fill("waiting@example.com");
  await shop.getByRole("checkbox").check();
  await shop.getByRole("button", { name: "Notify me" }).click();
  await expect(shop.getByText("You're on the list. We'll email you once.")).toBeVisible();
  await shopper.close();

  await page.goto("/admin");
  await expect(page.getByText("1 back-in-stock request waiting")).toBeVisible();

  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Sold Out Tote" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.locator('[id^="inspector-stock-"]').first().fill("10");
  await page.getByTestId("variant-save").first().click();
  await expect(page).toHaveURL(/#variants$/);
  await expect(page.getByRole("cell", { name: "10", exact: true })).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByText("0 back-in-stock requests waiting")).toBeVisible();
});
