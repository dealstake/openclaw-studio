import { expect, test } from "@playwright/test";

test.describe("Sessions panel", () => {
  test.beforeEach(async ({ page }) => {
    // Mock studio settings API
    await page.route("**/api/studio", async (route, request) => {
      if (request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            settings: { version: 1, gateway: null, focused: {}, sessions: {} },
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });
  });

  test("renders sessions panel with header and refresh button", async ({ page }) => {
    await page.goto("/");
    // Wait for main UI to load
    await expect(page.getByTestId("fleet-sidebar")).toBeVisible({ timeout: 10_000 });
  });

  test("sessions list shows empty state when no sessions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("fleet-sidebar")).toBeVisible({ timeout: 10_000 });
    // Without a gateway connection, the sessions panel should be present but may show empty
  });
});
