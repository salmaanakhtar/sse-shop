import { expect, test } from "@playwright/test";

test("search filters and SEO endpoints work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search" }).fill("Essential");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/\/search\?q=Essential/);
  await expect(page.getByRole("heading", { name: "Search products" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Search products" })
      .getByRole("link", { name: /Essential Tee/ }),
  ).toBeVisible();

  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/products/essential-tee");

  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");

  await page.goto("/products/essential-tee");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});
