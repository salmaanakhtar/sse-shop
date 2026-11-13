import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const password = "correct-horse-battery-staple";
let accountEmail = "";
let firstOrderNumber = "";

test.beforeAll(() => {
  accountEmail = `customer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
});

test("a customer signs up, saves an address, and checks out", async ({ page }) => {
  await page.goto("/account/sign-up");

  await page.getByLabel("Name").fill("E2E Customer");
  await page.getByLabel("Email").fill(accountEmail);
  await page.getByLabel("Mobile (optional)").fill("+971501234567");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(accountEmail)).toBeVisible();

  await page.goto("/account/addresses/new");
  await page.getByLabel("Label (optional)").fill("Home");
  await page.getByLabel("Recipient name").fill("E2E Customer");
  await page.getByLabel("Mobile").fill("+971501234567");
  await page.getByLabel("Emirate").selectOption("Dubai");
  await page.getByLabel("Building or villa").fill("Villa 12");
  await page.getByLabel("Street").fill("Al Wasl Road");
  await page.getByLabel("Area or community (optional)").fill("Jumeirah 1");
  await page.getByRole("button", { name: "Save address" }).click();

  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(page.getByText("Villa 12, Al Wasl Road")).toBeVisible();
  await expect(page.getByText("Delivery default")).toBeVisible();
  await expect(page.getByText("Billing default")).toBeVisible();

  await page.goto("/products/essential-tee");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.goto("/cart");
  await expect(page.getByTestId("cart-total")).toHaveText(/AED\s140\.00/);
  await page.getByRole("link", { name: "Checkout" }).click();

  await expect(page.getByLabel("Email")).toHaveValue(accountEmail);
  await expect(page.getByLabel("Full name")).toHaveValue("E2E Customer");
  await expect(page.getByLabel("Mobile")).toHaveValue("+971501234567");
  await expect(page.getByLabel("Building or villa")).toHaveValue("Villa 12");
  await expect(page.getByLabel("Same as delivery address")).toBeChecked();

  await page.getByTestId("place-order").click();

  await expect(page).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\?t=/);
  firstOrderNumber =
    page.url().match(/\/orders\/(SS-\d{4}-\d{6})/)?.[1] ?? "";
  expect(firstOrderNumber).not.toBe("");

  await page.goto("/account/orders");
  await expect(page.getByRole("link", { name: firstOrderNumber })).toBeVisible();
});

test("an anonymous cart is merged into the account on sign-in", async ({ page }) => {
  await page.goto("/products/essential-tee");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.goto("/account/sign-in");
  await page.getByLabel("Email").fill(accountEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/cart");
  await expect(page.getByTestId("cart-quantity")).toHaveText("1");
});

test("a guest order can be claimed from its lookup link", async ({ page }) => {
  await page.goto("/products/essential-tee");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.goto("/checkout");
  await page.getByLabel("Email").fill(`guest-${Date.now()}@example.com`);
  await page.getByLabel("Full name").fill("Guest Buyer");
  await page.getByLabel("Mobile").fill("+971509876543");
  await page.getByLabel("Building or villa").fill("Villa 9");
  await page.getByLabel("Street").fill("Beach Road");

  await page.getByLabel("Same as delivery address").uncheck();
  await page.locator("#billingFullName").fill("Guest Billing");
  await page.locator("#billingPhone").fill("+971501112223");
  await page.locator("#billingBuilding").fill("Office 5");
  await page.locator("#billingStreet").fill("Sheikh Zayed Road");

  await page.getByTestId("place-order").click();

  await expect(page).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\?t=/);
  await expect(page.getByText("Billing address")).toBeVisible();
  await expect(page.getByText("Guest Billing")).toBeVisible();
  const guestOrderNumber =
    page.url().match(/\/orders\/(SS-\d{4}-\d{6})/)?.[1] ?? "";
  expect(guestOrderNumber).not.toBe("");

  await page.getByRole("link", { name: "Sign in to save" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in\?next=/);

  await page.getByLabel("Email").fill(accountEmail);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(new RegExp(`/orders/${guestOrderNumber}\\?t=`));
  await page.getByRole("button", { name: "Save this order to my account" }).click();

  await expect(page).toHaveURL(new RegExp(`/account/orders/${guestOrderNumber}`));
  await expect(page.getByText("Billing address")).toBeVisible();
  await page.goto("/account/orders");
  await expect(page.getByRole("link", { name: guestOrderNumber })).toBeVisible();
});

test("a customer can delete their own account", async ({ page }) => {
  const email = `customer-delete-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

  await page.goto("/account/sign-up");
  await page.getByLabel("Name").fill("Delete Me");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/account/delete");
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();

  await expect(page).toHaveURL(/\/account\/sign-in\?deleted=1/);
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
