import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

test("newsletter opt-in and a campaign send", async ({ page, browser }) => {
  const anonymous = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const visitor = await anonymous.newPage();

  await visitor.goto("/newsletter");
  await visitor.getByLabel("Name (optional)").fill("Newsletter Visitor");
  await visitor
    .getByRole("textbox", { name: "Email" })
    .fill(`newsletter-${Date.now()}@example.com`);
  await visitor.getByRole("checkbox").check();
  await visitor.getByRole("button", { name: "Subscribe" }).click();
  await expect(
    visitor.getByText("Check your inbox. The confirmation link finishes the subscription."),
  ).toBeVisible();

  await visitor.goto("/newsletter/unsubscribe?token=not-a-real-token");
  await expect(visitor.getByText("That unsubscribe link is invalid.")).toBeVisible();
  await anonymous.close();

  await page.goto("/account");
  const marketing = page.getByLabel("Email me about new products and offers");
  if (!(await marketing.isChecked())) await marketing.check();
  await page.getByRole("button", { name: "Save preference" }).click();
  await expect(page.getByText(/Opted in/)).toBeVisible();

  await page.goto("/admin/campaigns/new");
  await page.getByLabel("Subject").fill("Playwright campaign");
  await page.getByLabel("Body").fill("A short campaign body for the test.");
  await page.getByRole("button", { name: "Create campaign" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns\/[0-9a-f-]{36}$/);

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/Sent \d+ emails/)).toBeVisible();

  await page.goto("/admin/campaigns");
  await expect(page.getByRole("link", { name: "Playwright campaign" }).first()).toBeVisible();
  await expect(page.getByText("sent", { exact: true }).first()).toBeVisible();
});
