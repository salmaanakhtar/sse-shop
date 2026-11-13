import { expect, test as setup } from "@playwright/test";
import { generateSync } from "otplib";

const authFile = "tests/e2e/.auth/admin.json";
const email = process.env.E2E_ADMIN_EMAIL ?? "owner@example.com";
const password = process.env.E2E_ADMIN_PASSWORD ?? "change-this-admin-password";

setup.setTimeout(60_000);

/**
 * Signs in through the real UI, enrols TOTP when the admin config requires it,
 * then parks the session cookie for the admin specs. This is deliberately not
 * an API shortcut: the login and enrolment forms are part of what Phase 1
 * promises.
 */
setup("admin signs in and prepares two-factor when required", async ({ page }) => {
  await page.goto("/admin/sign-in");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Sign-in resolves to /admin, and the guard then bounces to enrolment when
  // two-factor is still off. Either landing page is valid at this point.
  const setupHeading = page.getByRole("heading", { name: "Secure your account" });
  const overviewHeading = page.getByRole("heading", { name: "Overview" });

  await expect(setupHeading.or(overviewHeading)).toBeVisible();

  if (await setupHeading.isVisible()) {
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Start setup" }).click();

    const secret = (await page.locator("code").first().innerText()).trim();
    await page.getByLabel("Code from the app").fill(generateSync({ secret }));
    await page.getByRole("button", { name: "Turn on two-step verification" }).click();
  }

  await expect(overviewHeading).toBeVisible();
  await page.context().storageState({ path: authFile });
});
