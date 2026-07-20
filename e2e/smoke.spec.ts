import { test, expect } from "@playwright/test";

test("health endpoint reports ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ status: "ok" });
});

test("unauthenticated visitor is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("sign up, accept consent, reach profile", async ({ page }) => {
  // Unique account per run so reruns don't collide.
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  // New accounts have no consent yet, so they land on the consent screen.
  await expect(page).toHaveURL(/\/consent/);
  await expect(page.getByText("Before you start", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /I understand/ }).click();

  // Consent recorded -> profile page, and the app shell is now present.
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible();
});
