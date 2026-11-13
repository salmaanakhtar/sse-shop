import { expect, test } from "@playwright/test";

test("a shopper can browse, add to cart, and place an order", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: /Essential Tee/ }).click();
  await expect(page).toHaveURL(/\/products\/essential-tee$/);

  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.getByRole("link", { name: /^Cart/ }).click();
  await expect(page.getByTestId("cart-total")).toHaveText(/AED\s140\.00/);

  await page.getByRole("link", { name: "Checkout" }).click();

  await page.getByLabel("Email").fill("shopper@example.com");
  await page.getByLabel("Full name").fill("Ayesha Khan");
  await page.getByLabel("Mobile").fill("+971501234567");
  await page.getByLabel("Building or villa").fill("Villa 12");
  await page.getByLabel("Street").fill("Al Wasl Road");
  await page.getByLabel("Delivery notes (optional)").fill("Gate 3");

  await page.getByTestId("place-order").click();

  await expect(page).toHaveURL(/\/orders\/SS-\d{4}-\d{6}\?t=/);
  await expect(page.getByText("Order confirmed")).toBeVisible();
  await expect(page.getByRole("heading", { name: /SS-\d{4}-\d{6}/ })).toBeVisible();
  await expect(page.getByText("Ayesha Khan")).toBeVisible();
  await expect(page.getByText(/Includes\sAED\s6\.67 VAT/)).toBeVisible();

  // The cart is consumed, and the header lives in the layout: the badge must
  // clear on the confirmation page, not just on the next full reload.
  await expect(page.getByRole("link", { name: /^Cart/ })).toHaveText("Cart");
});

test("the cart survives a reload", async ({ page }) => {
  await page.goto("/products/essential-tee");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.reload();
  await page.goto("/cart");

  await expect(page.getByTestId("cart-quantity")).toHaveText("1");
});

test("a shopper selects a parent branch and then its child", async ({ page }) => {
  await page.goto("/products/essential-tee");

  await expect(page.getByText("Selected: Black / S")).toBeVisible();
  await page.getByRole("button", { name: "White" }).click();
  await page.getByRole("button", { name: "M" }).click();

  await expect(page.getByText("Selected: White / M")).toBeVisible();
  await expect(page.getByText(/AED\s125\.00/)).toBeVisible();

  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await page.getByRole("link", { name: /^Cart/ }).click();
  await expect(page.getByText("White / M")).toBeVisible();
});

test("the stock limit is enforced server-side", async ({ page }) => {
  await page.goto("/products/sample-cap");

  const addToCart = page.getByTestId("add-to-cart");

  await addToCart.click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await addToCart.click();
  await expect(page.getByRole("status")).toHaveText("Added to cart.");

  await addToCart.click();
  await expect(page.getByRole("status")).toHaveText("Only 2 left in stock.");
});

test("an invalid order link cannot read the order", async ({ page }) => {
  const response = await page.goto("/orders/SS-2026-000001?t=not-a-real-token");
  expect(response?.status()).toBe(404);
});
