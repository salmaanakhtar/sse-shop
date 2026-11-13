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
  const card = page
    .getByRole("region", { name: "All products" })
    .getByRole("link", { name: /Playwright Hoodie/ });
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

test("admin builds a category tree, a collection, and a badge", async ({ page }) => {
  await page.goto("/admin/categories/new");
  await page.getByLabel("Name").fill("Playwright Apparel");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByRole("link", { name: /Playwright Apparel/ })).toBeVisible();

  await page.goto("/admin/categories/new");
  await page.getByLabel("Name").fill("Playwright Tops");
  await page.getByLabel("Parent category").selectOption({ label: "Playwright Apparel" });
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByRole("link", { name: /Playwright Tops/ })).toBeVisible();

  await page.goto("/");
  const categoryNav = page.getByRole("navigation", { name: "Categories" });
  await expect(categoryNav.getByRole("link", { name: "Playwright Apparel" })).toBeVisible();

  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Playwright Hoodie" }).click();
  await page.getByRole("checkbox", { name: /Playwright Tops/ }).check();
  await page.getByRole("button", { name: "Save categories" }).click();
  await expect(page).toHaveURL(/#categories$/);
  await expect(page.getByRole("checkbox", { name: /Playwright Tops/ })).toBeChecked();

  await page.goto("/category/playwright-apparel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Playwright Apparel");
  await expect(page.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  await page.goto("/category/playwright-tops");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Playwright Tops");
  await expect(page.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  await page.goto("/admin/collections/new");
  await page.getByLabel("Name").fill("Playwright Picks");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page).toHaveURL(/\/admin\/collections\/[0-9a-f-]{36}$/);

  await page.selectOption("#collection-product", { label: "Playwright Hoodie (active)" });
  await page.getByRole("button", { name: "Add to collection" }).click();
  await expect(page).toHaveURL(/#products$/);
  await expect(page.getByRole("link", { name: "Playwright Hoodie" })).toBeVisible();

  await page.goto("/");
  const picks = page.getByRole("region", { name: "Playwright Picks collection" });
  await expect(picks.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  await page.goto("/collections/playwright-picks");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Playwright Picks");
  await expect(page.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  await page.goto("/admin/badges");
  await page.getByLabel("Label").fill("Playwright Badge");
  await page.getByLabel("Tone").selectOption("success");
  await page.getByRole("button", { name: "Create badge" }).click();
  await expect(page).toHaveURL(/\/admin\/badges$/);
  await expect(page.getByText("Playwright Badge", { exact: true })).toBeVisible();

  await page.goto("/admin/products");
  await page.getByRole("link", { name: "Playwright Hoodie" }).click();
  await page.getByRole("checkbox", { name: /Playwright Badge/ }).check();
  await page.getByRole("button", { name: "Save badges" }).click();
  await expect(page).toHaveURL(/#badges$/);

  await page.goto("/");
  const allProducts = page.getByRole("region", { name: "All products" });
  const card = allProducts.getByRole("link", { name: /Playwright Hoodie/ });
  await expect(card.getByText("Playwright Badge")).toBeVisible();

  await page.goto(`/products/${SLUG}`);
  await expect(page.getByText("Playwright Badge")).toBeVisible();
});

test("admin creates a promotion carousel and it appears on the home page", async ({ page }) => {
  const fillSlide = async (headline: string, subheadline: string, cta: string) => {
    await page.goto("/admin/promotions/new");
    await page.getByLabel("Headline", { exact: true }).fill(headline);
    await page.getByLabel("Subheadline").fill(subheadline);
    await page.getByLabel("Button label").fill(cta);
    await page.setInputFiles("#promotion-image", "tests/e2e/fixtures/product.png");
    await page.getByLabel("Image alt text").fill(headline);
  };

  await fillSlide("Weekend Sale", "Up to 34% off selected pieces", "Shop the sale");
  await page.getByLabel("Category").selectOption({ label: "Playwright Apparel" });
  await page.getByRole("button", { name: "Create slide" }).click();
  await expect(page).toHaveURL(/\/admin\/promotions$/);

  await fillSlide("New Arrivals", "Fresh pieces just landed", "Browse new");
  await page.getByRole("button", { name: "Product" }).click();
  await page.getByRole("button", { name: "Choose a product" }).click();
  const productDialog = page.getByRole("dialog", { name: "Choose a product" });
  await productDialog.getByLabel("Search products").fill("Playwright Hoodie");
  await productDialog.getByRole("button", { name: /Playwright Hoodie/ }).click();
  await expect(productDialog).toBeHidden();
  await page.getByRole("button", { name: "Create slide" }).click();
  await expect(page).toHaveURL(/\/admin\/promotions$/);

  await page.goto("/");
  await page.getByRole("region", { name: "Promotions" }).hover();
  await expect(page.getByRole("heading", { name: "Weekend Sale" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Weekend Sale/ })).toHaveAttribute(
    "href",
    "/category/playwright-apparel",
  );

  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(page.getByRole("heading", { name: "New Arrivals" })).toBeVisible();
  await expect(page.getByRole("link", { name: /New Arrivals/ })).toHaveAttribute(
    "href",
    "/products/playwright-hoodie",
  );
});

test("admin can open the customer list", async ({ page }) => {
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByPlaceholder("Search name, email, or phone")).toBeVisible();
});
