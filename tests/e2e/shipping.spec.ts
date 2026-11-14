import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });
test.describe.configure({ mode: "serial" });

test("an emirate weight band changes the checkout delivery charge", async ({
  page,
  browser,
}) => {
  await page.goto("/admin/shipping");
  const zone = page.locator("section", { has: page.getByRole("heading", { name: "Fujairah" }) });
  await zone.getByLabel("Charge (AED)").first().fill("35.00");
  await zone.getByRole("button", { name: "Save band" }).first().click();
  await expect(page.getByText("Shipping saved.")).toBeVisible();

  const shopper = await browser.newContext();
  const shop = await shopper.newPage();

  await shop.goto("/products/essential-tee");
  await shop.getByTestId("add-to-cart").click();
  await expect(shop.getByRole("status")).toHaveText("Added to cart.");
  await shop.goto("/checkout");
  await shop.getByLabel("Emirate").selectOption("Fujairah");
  await expect(shop.getByTestId("place-order")).toContainText("AED 155.00");

  await shop.getByLabel("Email").fill("fujairah@example.com");
  await shop.getByLabel("Full name").fill("Fujairah Customer");
  await shop.getByLabel("Mobile").fill("+971501234567");
  await shop.getByLabel("Building or villa").fill("Villa 9");
  await shop.getByLabel("Street").fill("Corniche Road");
  await shop.getByTestId("place-order").click();
  await expect(shop).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\?t=/);
  await expect(shop.getByText("Fujairah", { exact: true })).toBeVisible();
  await expect(shop.getByText(/AED\s155\.00/).first()).toBeVisible();

  await shopper.close();
});
