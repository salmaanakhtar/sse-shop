import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });
test.describe.configure({ mode: "serial" });

const SLUG = "playwright-hoodie";

test("admin creates, illustrates, and publishes a product", async ({ page }) => {
  await page.goto("/admin/products/new");

  await page.getByLabel("Name").fill("Playwright Hoodie");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);

  // Each admin mutation redirects to the same page. Wait for the result of one
  // before starting the next, otherwise the click lands on a stale form.
  await page.getByTestId("add-option-name").fill("Size");
  await page.getByTestId("add-option").click();
  await expect(page.getByText("Size", { exact: true })).toBeVisible();

  await page.getByTestId("add-option-value").fill("M");
  await page.getByTestId("add-option-value-submit").click();
  await expect(page.getByRole("button", { name: "M ×" })).toBeVisible();

  await page.locator("#add-price").fill("199.00");
  await page.locator("#add-stock").fill("5");
  await page.getByRole("button", { name: "Add branches" }).click();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await expect(page.getByTestId("variant-price")).toHaveValue("199.00");

  await page.setInputFiles("#image", "tests/e2e/fixtures/product.png");
  await page.getByTestId("upload-product-image").click();
  await expect(page.locator('img[src*="media"]').first()).toBeVisible();

  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page).toHaveURL(/#details$/);
  await expect(page.getByText("active", { exact: true })).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Playwright Hoodie");
  await expect(page.getByText(/AED\s199\.00/)).toBeVisible();
});

test("a price change in admin reaches the storefront", async ({ page }) => {
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Playwright Hoodie" }).click();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByTestId("variant-price").first().fill("149.00");
  await page.getByTestId("variant-save").first().click();
  await expect(page.getByText(/AED\s149\.00/).first()).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByText(/AED\s149\.00/)).toBeVisible();
});

test("a sale price reaches the storefront, timer, and cart", async ({ page }) => {
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Playwright Hoodie" }).click();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByTestId("sale-price").fill("99.00");
  await page.getByLabel("Ends").fill("2030-01-01T00:00");
  await page.getByRole("button", { name: "Save sale" }).click();

  await expect(page.getByText(/AED\s99\.00/).first()).toBeVisible();

  await page.goto("/admin/products");
  const adminRow = page.getByRole("row", { name: /Playwright Hoodie/ });
  await expect(adminRow.getByTitle(/variant on sale/)).toBeVisible();

  await page.goto("/");
  const card = page.getByRole("link", { name: /Playwright Hoodie/ });
  await expect(card.getByText(/Sale\s*−34%/)).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByText(/AED\s99\.00/)).toBeVisible();
  await expect(page.getByText(/AED\s149\.00/)).toBeVisible();
  await expect(page.getByTestId("sale-timer")).toBeVisible();

  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.getByRole("link", { name: /^Cart/ }).click();
  await expect(page.getByTestId("cart-total")).toHaveText(/AED\s119\.00/);
});

test("admin can open the customer list", async ({ page }) => {
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByPlaceholder("Search name, email, or phone")).toBeVisible();
});
