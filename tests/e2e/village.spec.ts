import { expect, test } from "@playwright/test";

/**
 * The demo moment (§15) and the first-time guide, end to end with a fresh guest:
 * Gate → villager → kitten → tour → walk (via "Take me there") → wish → teach → light the lantern,
 * then book a teacher whose lantern is lit, run the lesson in a Lantern Room, confirm, and see Plain mode.
 */
test("a first visit through the village, a booked lesson, and Plain mode", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  // 1 · the Gate explains the idea before anything else
  const gate = page.getByRole("dialog", { name: "The Gate" });
  await expect(gate).toBeVisible({ timeout: 90_000 });
  await expect(gate.getByText("Find a lit lantern")).toBeVisible();
  await page.getByRole("button", { name: "Enter the village" }).click();

  // 2 · villager, 3 · kitten
  await expect(page.getByRole("dialog", { name: "Make your villager" })).toBeVisible();
  await page.getByRole("button", { name: "Surprise me" }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByRole("dialog", { name: "Pick your kitten" })).toBeVisible();
  await page.locator("fieldset label").nth(1).click();
  await page.getByLabel("Name your kitten").fill("Miso");
  await page.getByRole("button", { name: "Adopt Miso" }).click();

  // back in the world: the tour, once, and it stays dismissed
  await expect(page.getByText("This is you")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: "test-results/village-tour.png" });
  // Regression: from step 2 the footer (Skip, Back, Next) used to widen the card's column and push the
  // text and buttons past its edge. Nothing inside the card may extend beyond it, on any step.
  const card = page.getByRole("dialog", { name: /This is you|Talk, read, enter|Your hours/ });
  for (let i = 0; i < 3; i++) {
    const overflow = await page.locator("[aria-labelledby=tour-title]").evaluate((c) => {
      const box = c.getBoundingClientRect();
      let worst = 0;
      for (const el of c.querySelectorAll("*"))
        worst = Math.max(worst, el.getBoundingClientRect().right - box.right);
      return Math.round(worst);
    });
    expect(overflow).toBeLessThanOrEqual(0);
    if (i < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(card).toBeVisible();
  await page.screenshot({ path: "test-results/village-tour-hours.png" });
  await page.getByRole("button", { name: "Skip tour" }).click();
  const quest = page.getByRole("region", { name: "First steps" });
  await expect(quest).toContainText("Walk to the Wishing Well");
  await expect(page.locator("[data-guide=offscreen]")).toContainText("Wishing Well");

  // 4 · "Take me there" counts as reaching the Well → 5 · the wish
  await quest.getByRole("button", { name: "Take me there" }).click();
  await expect(page.getByRole("dialog", { name: "Wishing Well" })).toBeVisible({ timeout: 20_000 });
  await page.locator("#wish").fill("chords for one song on guitar");
  await expect(page.getByText(/read this/)).toBeVisible();
  await page.getByRole("button", { name: /Toss the coin/ }).click();
  await expect(page.getByText("Your wish is in the Well")).toBeVisible();
  await page.getByRole("button", { name: "Back to the village", exact: true }).click();

  // 6 · what you teach
  await expect(page.getByText("What can you teach? Pick up to three.")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  // 7 · your hut: light the lantern; the guide is done
  await expect(page.getByText("This is your hut. Light the lantern when you're free to teach.")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /Light/ }).click();
  await expect(quest).toBeHidden({ timeout: 15_000 });
  await page.screenshot({ path: "test-results/village-done.png" });

  // A lit lantern on the Notice Board → the booking scroll → the Lantern Room
  await page.goto("/board");
  await expect(page.getByRole("heading", { name: "Notice Board", level: 1 })).toBeVisible();
  await page
    .locator("li.card")
    .filter({ hasText: "Free now" })
    .first()
    .getByRole("button", { name: "Book" })
    .click();
  await expect(page.getByText(/Cost .* held now, paid after you both confirm/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /^Hold .* and book$/ }).click();
  await expect(page).toHaveURL(/\/sessions\//, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Start the lesson" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Start the lesson" }).click();
  await expect(page.getByRole("button", { name: "Leave the room" })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "test-results/village-lantern-room.png" });
  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.getByText("Before you go")).toBeVisible();
  await page.getByRole("button", { name: "Confirm session" }).click();
  await expect(page.getByText("Settled. You both confirmed.")).toBeVisible({ timeout: 45_000 });

  // Plain mode: the same village as pages
  await page.goto("/bank");
  await expect(page.getByRole("heading", { name: "Hourglass Bank", level: 1 })).toBeVisible();
  await expect(page.getByText(/taught|learned|held for/).first()).toBeVisible();

  expect(errors).toEqual([]);
});
