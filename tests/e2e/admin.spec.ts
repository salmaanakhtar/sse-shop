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

  await page.goto("/admin/home");
  const addSection = page.getByTestId("add-home-section");
  await addSection.locator("#section-kind-new").selectOption("collection");
  await addSection.locator("#section-source-new").selectOption({ label: "Playwright Picks" });
  await addSection.locator("#section-title-new").fill("Playwright Picks");
  await addSection.getByRole("button", { name: "Add section" }).click();
  await expect(page).toHaveURL(/\/admin\/home$/);

  await page.goto("/");
  await page.reload();
  const picks = page.getByRole("region", { name: "Playwright Picks products" });
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

test("admin builds a promotion page with category, collection, and product rows", async ({
  page,
}) => {
  const createPromotion = async (
    headline: string,
    slug: string,
    subheadline: string,
    cta: string,
  ) => {
    await page.goto("/admin/promotions/new");
    await page.getByLabel("Headline", { exact: true }).fill(headline);
    await page.getByLabel("Page URL slug").fill(slug);
    await page.getByLabel("Subheadline").fill(subheadline);
    await page.getByLabel("Button label").fill(cta);
    await page.setInputFiles("#promotion-image", "tests/e2e/fixtures/product.png");
    await page.getByLabel("Image alt text").fill(headline);
    await page.getByRole("button", { name: "Create promotion" }).click();
    await expect(page).toHaveURL(/\/admin\/promotions\/[0-9a-f-]{36}#rows$/);
  };

  await createPromotion(
    "Weekend Sale",
    "weekend-sale",
    "Up to 34% off selected pieces",
    "Shop the sale",
  );

  await page.getByLabel("Category", { exact: true }).selectOption({
    label: "Playwright Apparel",
  });
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(page).toHaveURL(/#rows$/);
  await expect(page.getByRole("heading", { name: "Playwright Apparel" })).toBeVisible();

  await page.getByRole("button", { name: "Collection", exact: true }).click();
  await page.getByLabel("Collection", { exact: true }).selectOption({
    label: "Playwright Picks",
  });
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(page).toHaveURL(/#rows$/);
  await expect(page.getByRole("heading", { name: "Playwright Picks" })).toBeVisible();

  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Choose products" }).click();
  const productDialog = page.getByRole("dialog", { name: "Choose products" });
  await productDialog.getByLabel("Search products").fill("Playwright Hoodie");
  await productDialog.getByRole("checkbox", { name: /Playwright Hoodie/ }).check();
  await productDialog.getByRole("button", { name: "Done" }).click();
  await page.getByLabel("New row heading").fill("Editor's picks");
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(page).toHaveURL(/#rows$/);
  await expect(page.getByRole("heading", { name: "Editor's picks" })).toBeVisible();

  await createPromotion(
    "New Arrivals",
    "new-arrivals",
    "Fresh pieces just landed",
    "Browse new",
  );

  await page.goto("/");
  await page.getByRole("region", { name: "Promotions" }).hover();
  await expect(page.getByRole("heading", { name: "Weekend Sale" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Weekend Sale/ })).toHaveAttribute(
    "href",
    "/promotions/weekend-sale",
  );

  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(page.getByRole("heading", { name: "New Arrivals" })).toBeVisible();
  await expect(page.getByRole("link", { name: /New Arrivals/ })).toHaveAttribute(
    "href",
    "/promotions/new-arrivals",
  );

  await page.goto("/promotions/weekend-sale");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Weekend Sale");

  const categoryRow = page.getByRole("region", { name: "Playwright Apparel products" });
  await expect(categoryRow.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  const collectionRow = page.getByRole("region", { name: "Playwright Picks products" });
  await expect(collectionRow.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();

  const productRow = page.getByRole("region", { name: "Editor's picks products" });
  await expect(productRow.getByRole("link", { name: /Playwright Hoodie/ })).toBeVisible();
});

test("admin fulfils an order, handles a return, refunds, and issues an invoice", async ({
  page,
  browser,
}) => {
  const shopper = await browser.newContext();
  const shop = await shopper.newPage();

  await shop.goto("/products/essential-tee");
  await shop.getByTestId("add-to-cart").click();
  await expect(shop.getByRole("status")).toHaveText("Added to cart.");
  await shop.goto("/checkout");
  await shop.getByLabel("Email").fill("order-ops@example.com");
  await shop.getByLabel("Full name").fill("Order Ops Customer");
  await shop.getByLabel("Mobile").fill("+971501234567");
  await shop.getByLabel("Building or villa").fill("Villa 7");
  await shop.getByLabel("Street").fill("Al Wasl Road");
  await shop.getByTestId("place-order").click();
  await expect(shop).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\?t=/);

  const orderUrl = new URL(shop.url());
  const orderNumber = decodeURIComponent(orderUrl.pathname.split("/").pop() ?? "");
  const orderPath = `${orderUrl.pathname}${orderUrl.search}`;

  await page.goto("/admin/orders");
  await page.getByRole("link", { name: orderNumber, exact: true }).click();
  await expect(page.getByRole("heading", { name: orderNumber })).toBeVisible();

  await page.getByRole("button", { name: "Start processing" }).click();
  await expect(page.getByText("Order updated.")).toBeVisible();

  await page.locator("#carrier").fill("Aramex");
  await page.locator("#trackingNumber").fill("ARX-E2E-1");
  await page.getByRole("button", { name: "Mark shipped & email customer" }).click();
  await expect(page.getByText("ARX-E2E-1").first()).toBeVisible();

  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("Order delivered.")).toBeVisible();

  await shop.goto(orderPath);
  await expect(shop.getByText("ARX-E2E-1")).toBeVisible();
  await shop.getByLabel("Reason").fill("The fabric is not what I expected.");
  await shop.getByRole("button", { name: "Submit return request" }).click();
  await expect(shop.getByText("Your return request was sent.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Approve return & restock" }).click();
  await expect(page.getByText("Return received and stock restored.")).toBeVisible();

  await page.locator("#refund-amount").fill("20.00");
  await page.locator("#refund-reason").fill("Delivery charge");
  await page.getByRole("button", { name: "Record refund" }).click();
  await expect(page.getByText(/20\.00 AED refunded/)).toBeVisible();

  await shop.goto(orderPath);
  await expect(shop.getByRole("heading", { name: "Refund" })).toBeVisible();
  await expect(shop.getByText(/AED\s20\.00 has been recorded/)).toBeVisible();

  await page.getByRole("button", { name: "Issue invoice" }).click();
  await expect(page).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\/invoice$/);
  await expect(page.getByText(/INV-\d{4}-\d{6}/).first()).toBeVisible();

  const pdfHref = await page.getByRole("link", { name: "Download PDF" }).getAttribute("href");
  expect(pdfHref).toBeTruthy();
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await shopper.close();
});

test("admin can open the customer list", async ({ page }) => {
  await page.goto("/admin/customers");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await expect(page.getByPlaceholder("Search name, email, or phone")).toBeVisible();
});
