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

  await page.getByTestId("generate-price").fill("199.00");
  await page.getByTestId("generate-stock").fill("5");
  await page.getByTestId("generate-variants").click();
  await expect(page.getByTestId("variant-price")).toHaveValue("199.00");

  await page.setInputFiles('input[type="file"]', "tests/e2e/fixtures/product.png");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.locator('img[src*="media"]').first()).toBeVisible();

  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText(/Published|active/i).first()).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Playwright Hoodie");
  await expect(page.getByText(/AED\s199\.00/)).toBeVisible();
});

test("a price change in admin reaches the storefront", async ({ page }) => {
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Playwright Hoodie" }).click();

  await page.getByTestId("variant-price").first().fill("149.00");
  await page.getByTestId("variant-save").first().click();
  await expect(page.getByText(/AED\s149\.00/).first()).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByText(/AED\s149\.00/)).toBeVisible();
});
