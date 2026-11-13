import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "correct-horse-battery-staple";
let accountEmail = "";

test.beforeAll(() => {
  accountEmail = `customer-wishlist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
});

test("a customer saves a variant to two lists and checks out from one", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/account/sign-up");
  await page.getByLabel("Name").fill("Wishlist Customer");
  await page.getByLabel("Email").fill(accountEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/account/wishlists");
  await expect(page.getByRole("heading", { name: "Wishlists" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saved" })).toBeVisible();

  await page.getByLabel("New list name").fill("Gifts");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/\/account\/wishlists\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Gifts" })).toBeVisible();

  await page.goto("/products/essential-tee");
  await page.getByRole("button", { name: "Save to wishlist" }).click();
  const dialog = page.getByRole("dialog", { name: "Save to wishlist" });
  await dialog.getByRole("checkbox", { name: /^Saved/ }).check();
  await dialog.getByRole("checkbox", { name: /^Gifts/ }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved to 2 lists.");

  await page.goto("/account/wishlists");
  await page.getByRole("link", { name: "Gifts" }).click();
  await expect(page.getByText("Essential Tee")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Nothing saved in this list yet.")).toBeVisible();

  await page.goto("/account/wishlists");
  await page.getByRole("link", { name: "Saved" }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
  await expect(page.getByText("Essential Tee")).toBeVisible();
  await expect(page.getByText("Black / S")).toBeVisible();

  await page.getByRole("button", { name: "Add selected to cart & checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
  await expect(page.getByText("Essential Tee")).toBeVisible();

  expect(
    consoleErrors.filter((message) => message.includes("Cannot specify a \"name\" prop")),
  ).toEqual([]);
});

test("dark mode persists in the browser and follows the signed-in account", async ({
  page,
  browser,
}) => {
  await page.goto("/account/sign-in");
  await page.getByLabel("Email").fill(accountEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/");
  await expect(page.locator("#storefront")).toHaveAttribute("data-theme", "system");

  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("#storefront")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("#storefront")).toHaveAttribute("data-theme", "dark");

  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const otherPage = await other.newPage();
  await otherPage.goto("/account/sign-in");
  await otherPage.getByLabel("Email").fill(accountEmail);
  await otherPage.getByLabel("Password").fill(password);
  await otherPage.getByRole("button", { name: "Sign in" }).click();
  await expect(otherPage).toHaveURL(/\/account$/);

  await otherPage.goto("/");
  await expect(otherPage.locator("#storefront")).toHaveAttribute("data-theme", "dark");
  await other.close();
});
