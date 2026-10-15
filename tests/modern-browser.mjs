import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLocalServer } from "../server/local-server.mjs";
const directory = mkdtempSync(path.join(os.tmpdir(), "sonik-modern-")),
  origin = "http://127.0.0.1:3198";
const { server, store } = createLocalServer({ directory, origin });
await store.initialize({
  name: "Guria Modern farm",
  timezone: "Asia/Tbilisi",
  ownerName: "Farm Owner",
  ownerUsername: "owner",
  password: "test-owner-long-password",
});
await new Promise((resolve) => server.listen(3198, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    requests = [],
    errors = [];
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  context.on("page", (page) => {
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
  });
  const page = await context.newPage();
  await page.goto(origin + "/modern");
  await page
    .getByRole("heading", { name: "Your farm, at a glance." })
    .waitFor();
  await page
    .getByText("Sample workspace · Modern preview", { exact: true })
    .waitFor();
  mkdirSync("tmp/screenshots", { recursive: true });
  await page.screenshot({
    path: "tmp/screenshots/modern-desktop.png",
    fullPage: true,
  });
  assert(
    !requests.some((url) =>
      /ProductionApp|firebase|firestore|identitytoolkit/.test(url),
    ),
    "Guest imported Classic/cloud",
  );
  await page.getByRole("button", { name: "Make it your farm" }).click();
  await page.getByRole("heading", { name: "Join your farm team" }).waitFor();
  await page.getByRole("button", { name: "Cloud", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).waitFor();
  await page.screenshot({
    path: "tmp/screenshots/modern-registration.png",
    fullPage: true,
  });
  await page.goto(origin + "/local");
  await page.getByLabel("Username", { exact: true }).fill("owner");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-owner-long-password");
  await page.getByRole("button", { name: "Sign in locally" }).click();
  await page
    .getByRole("heading", { name: "Guria Modern farm", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "sonik g2.0.1.4 · Try new UI" }).click();
  await page.getByText("Farm server connected", { exact: true }).waitFor();
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("button", { name: "Fields & planning" }).click();
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  await page.getByLabel("Field name", { exact: true }).fill("North blueberry");
  await page.getByLabel("Crop or variety").fill("Blueberry");
  await page.getByLabel("Area (ha)").fill("2.5");
  await page.getByRole("button", { name: "Save field", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on farm server" })
    .waitFor();
  await nav.getByRole("button", { name: "Harvest", exact: true }).click();
  await page
    .getByRole("button", { name: "Record harvest", exact: true })
    .click();
  await page
    .getByLabel("Harvest field")
    .selectOption({ label: "North blueberry" });
  await page.getByLabel("Harvest weight (kg)").fill("80");
  // Lose the response after the server committed the entry. Retrying must not duplicate it.
  let interrupted=false;
  await page.route('**/api/local/harvests',async route=>{
    if(route.request().method()==='POST'&&!interrupted){interrupted=true;await route.fetch();await route.abort('failed');}
    else await route.continue();
  });
  await page.getByRole("button", { name: "Save harvest", exact: true }).click();
  await page.getByRole('dialog').getByRole('alert').waitFor();
  await page.getByRole("button", { name: "Save harvest", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on farm server" })
    .waitFor();
  await nav.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "Add worker" }).click();
  await page.getByLabel("Worker name", { exact: true }).fill("Farm Worker");
  await page.getByLabel("Worker username").fill("worker");
  await page.getByLabel("Initial password").fill("test-worker-long-password");
  await page
    .getByRole("button", { name: "Create worker", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on farm server" })
    .waitFor();
  await page.getByRole("link", { name: "sonik g2.0.1.4", exact: true }).click();
  await page.getByText("Total recorded: 80 kg", { exact: true }).waitFor();
  await page.getByRole("link", { name: "sonik g2.0.1.4 · Try new UI" }).click();
  await page.getByText("Farm server connected", { exact: true }).waitFor();
  for (const [width, height, name] of [
    [820, 1180, "tablet"],
    [390, 844, "mobile"],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Layout overflow " + name,
    );
    await page.screenshot({
      path: `tmp/screenshots/modern-${name}.png`,
      fullPage: true,
    });
  }
  const worker = await browser.newPage();
  await worker.goto(origin + "/modern/login");
  await worker.getByLabel("Username", { exact: true }).fill("worker");
  await worker
    .getByLabel("Password", { exact: true })
    .fill("test-worker-long-password");
  await worker
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await worker.getByText("Farm server connected", { exact: true }).waitFor();
  await worker
    .getByRole("navigation")
    .first()
    .getByRole("button", { name: "Fields & planning" })
    .click();
  assert.equal(
    await worker
      .getByRole("button", { name: "Add field", exact: true })
      .count(),
    0,
  );
  await worker
    .getByRole("navigation")
    .first()
    .getByRole("button", { name: "Team", exact: true })
    .click();
  assert.equal(
    await worker.getByRole("button", { name: "Add worker" }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: isolated guest, registration layout, Classic version entry/return, shared local fields/harvest/team, interrupted-save retry without duplication, worker restrictions and tablet/mobile overflow.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
