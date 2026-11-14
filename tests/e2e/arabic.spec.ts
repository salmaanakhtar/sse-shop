import { expect, test } from "@playwright/test";

test("the Arabic storefront uses /ar, RTL, and numeral preferences", async ({ page }) => {
  await page.goto("/ar");

  const shell = page.locator("#storefront");
  await expect(shell).toHaveAttribute("dir", "rtl");
  await expect(shell).toHaveAttribute("lang", "ar");
  await expect(
    page.getByRole("navigation", { name: "الفئات" }).getByRole("link", {
      name: "جميع المنتجات",
    }),
  ).toBeVisible();

  await page.goto("/ar/products/essential-tee");
  await expect(page.getByTestId("add-to-cart")).toHaveText("أضف إلى السلة");

  await page.getByRole("button", { name: "٠١٢" }).click();
  await expect(page).toHaveURL(/\/ar\/products\/essential-tee/);
  await expect(page.getByText(/[٠-٩]/).first()).toBeVisible();

  await page.goto("/ar/account/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تسجيل الدخول");
  await expect(page.locator("#storefront")).toHaveAttribute("dir", "rtl");

  await page.goto("/ar/newsletter");
  await expect(page.getByText("النشرة البريدية").first()).toBeVisible();

  await page.goto("/ar/cart");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سلتك فارغة");

  await page.goto("/ar/products/essential-tee");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/products\/essential-tee$/);
  await expect(page.getByTestId("add-to-cart")).toHaveText("Add to cart");
});
