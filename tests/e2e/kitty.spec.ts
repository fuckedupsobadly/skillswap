import { expect, test } from "@playwright/test";

/**
 * The gamification demo moment, end to end in a real browser with a fresh guest:
 * adopt a kitten, see it on the page, feed it, then teach-and-learn loop: book a session, both sides
 * confirm, and the kitty gets a treat with "+N XP" — and the First Paw badge unlocks.
 */
test("adopt a kitten, settle a session, and the kitty earns XP and a treat", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("What do you want to learn?", {
    timeout: 30_000,
  });

  // Adopt.
  await page.getByRole("link", { name: "Adopt a kitty" }).click();
  await expect(page.getByRole("heading", { name: "Pick your kitten" })).toBeVisible();
  const cards = page.locator("fieldset label");
  await expect(cards).toHaveCount(3);
  await cards.nth(1).click();
  await page.getByLabel("Name your kitten").fill("Miso");
  await page.getByRole("button", { name: "Adopt Miso" }).click();
  await expect(page.getByRole("heading", { name: "Miso", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wardrobe" })).toBeVisible();
  // Regression: the dock used to keep saying "Adopt a kitty" until a full reload.
  await expect(page.locator("[data-kitty-dock] button[aria-expanded]")).toContainText("Miso", {
    timeout: 10_000,
  });
  await page.screenshot({ path: "test-results/kitty-wardrobe.png" });

  // The kitty lives on the page: its button reads its state, and the canvas has pixels.
  await page.goto("/");
  const dock = page.locator("[data-kitty-dock] button[aria-expanded]");
  await expect(dock).toContainText("Miso", { timeout: 15_000 });
  await page.waitForTimeout(2500);
  const painted = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("canvas[aria-hidden]")!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(500);
  await page.screenshot({ path: "test-results/kitty-home.png" });

  // Feed it from the panel.
  await dock.click();
  await expect(page.getByRole("dialog", { name: /Miso/ })).toBeVisible();
  await page.screenshot({ path: "test-results/kitty-panel.png" });
  await page.getByRole("button", { name: "Feed" }).click();
  await expect(dock).toContainText(/eating|grooming/, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/kitty-eating.png" });

  // Teach-and-learn loop: book a session with a sample member, start it, confirm it.
  await page.goto("/explore?q=guitar");
  await page.locator("a[href^='/u/']").first().click();
  await page.getByRole("link", { name: "Book a session" }).click();
  await page.getByRole("button", { name: "Confirm and hold hours" }).click();
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByRole("button", { name: "Confirm session" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Confirm session" }).click();
  await expect(page.getByText("Settled: both sides confirmed")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\+\d+ XP · Miso got a treat/)).toBeVisible({ timeout: 15_000 });
  // Regression: the dock's status comes from what the kitty is doing, so it can't be stuck on "sleeping".
  await expect(dock).not.toContainText("sleeping", { timeout: 10_000 });
  await page.screenshot({ path: "test-results/kitty-settled.png" });

  // The kitty page shows the unlock.
  await page.goto("/kitty");
  await expect(page.getByText("First Paw")).toBeVisible();
  await expect(page.locator("li", { hasText: "First Paw" })).toContainText("Earned");
});
