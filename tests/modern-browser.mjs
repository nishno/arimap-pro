import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { createLocalServer } from "../server/local-server.mjs";
const directory = mkdtempSync("/tmp/agrimap-full-browser-"),
  origin = "http://127.0.0.1:3196";
const { server, store } = createLocalServer({ directory, origin });
await store.initialize({
  name: "Guria working farm",
  timezone: "Asia/Tbilisi",
  ownerName: "Farm Owner",
  ownerUsername: "owner",
  password: "test-owner-long-password",
});
await new Promise((r) => server.listen(3196, "127.0.0.1", r));
let browser,debugPage;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (r) =>
    new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
  );
  context.setDefaultTimeout(120000);
  const page = await context.newPage(),
    errors = [],
    requests = [];
  debugPage=page;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(origin + "/modern");
  await page.getByRole("button", { name: "Sign in locally" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/local");
  await page.getByLabel("Username", { exact: true }).fill("owner");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-owner-long-password");
  await page.getByRole("button", { name: "Sign in locally" }).click();
  await page
    .getByRole("heading", { name: "Guria working farm", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "sonik g2.0.1.4 · Try new UI" }).click();
  await page.getByRole("button", { name: "Stock", exact: true }).click();
  await page.getByRole("button", { name: "+ Add Item", exact: true }).click();
  await page.locator("input[name=name]").fill("Blueberry fertilizer");
  await page.locator("input[name=sku]").fill("GURIA-001");
  await page.locator("input[name=unitOfMeasure]").fill("kg");
  await page.locator("input[name=currentStock]").fill("25");
  await page.locator("input[name=unitCost]").fill("4");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await page.getByText("Blueberry fertilizer", { exact: true }).waitFor();
  const read = async (path) => {
    const response = await context.request.post(
      origin + "/api/local/documents/read",
      { headers: { Origin: origin }, data: { path } },
    );
    assert.equal(response.status(), 200);
    return response.json();
  };
  await assert.doesNotReject(async () => {
    for (let n = 0; n < 30; n++) {
      if (
        (await read("inventoryItems")).documents.some(
          (d) => d.name === "Blueberry fertilizer",
        )
      )
        return;
      await page.waitForTimeout(100);
    }
    throw Error("Inventory never committed to SQLite");
  });
  await page
    .getByRole("link", { name: "Switch to Classic", exact: true })
    .click();
  await page.getByText("Blueberry fertilizer", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Switch to Modern", exact: true })
    .click();
  await page.getByText("Blueberry fertilizer", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Blueberry fertilizer", { exact: true }).waitFor();
  for (const [mode, heading] of [
    ["harvesting", "Harvest"],
    ["tasks", "Tasks"],
    ["accounting", "Account"],
    ["agronomy", "Agronomy"],
    ["design", "Map"],
  ]) {
    await page.evaluate(
      (mode) =>
        window.dispatchEvent(
          new CustomEvent("agrimap-switch-mode", { detail: mode }),
        ),
      mode,
    );
    await page.waitForTimeout(350);
    assert(
      !(await page.getByText("Join your farm team", { exact: true }).count()),
    );
    assert(
      await page
        .getByRole("region", { name: "Application connection" })
        .isVisible(),
    );
  }
  await page.getByRole("button", { name: "Cloud backup", exact: true }).click();
  await page.getByRole("dialog", { name: "Cloud backup" }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("agrimap-switch-mode", { detail: "stock" }),
    ),
  );
  await page.getByText("Blueberry fertilizer", { exact: true }).waitFor();
  mkdirSync("tmp/screenshots", { recursive: true });
  await page.screenshot({
    path: "tmp/screenshots/full-modern-desktop.png",
    fullPage: true,
  });
  for (const [width, height, name] of [
    [820, 1180, "tablet"],
    [390, 844, "mobile"],
  ]) {
    await page.setViewportSize({ width, height });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Page overflow " + name,
    );
    await page.screenshot({
      path: `tmp/screenshots/full-modern-${name}.png`,
      fullPage: true,
    });
  }
  assert(
    !requests.some((url) =>
      /firestore.googleapis|identitytoolkit|securetoken.googleapis/.test(url),
    ),
    "Operational UI attempted automatic cloud traffic",
  );
  const createdWorker=await context.request.post(origin+'/api/local/users',{headers:{Origin:origin},data:{name:'Field Worker',username:'worker',password:'test-worker-long-password'}});assert.equal(createdWorker.status(),201);
  const worker=await browser.newContext();await worker.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const workerLogin=await worker.request.post(origin+'/api/local/login',{headers:{Origin:origin},data:{username:'worker',password:'test-worker-long-password'}});assert.equal(workerLogin.status(),200);const workerPage=await worker.newPage();workerPage.on('pageerror',e=>errors.push(e.message));await workerPage.goto(origin+'/modern');await workerPage.getByRole('region',{name:'Application connection'}).waitFor();assert.equal(await workerPage.getByRole('button',{name:'Cloud backup',exact:true}).count(),0);await workerPage.waitForTimeout(600);await worker.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: full application local authentication, real inventory UI save to SQLite, Classic/Modern switching, reload persistence, module navigation, backup dialog, mobile/tablet and no automatic Firebase traffic.",
  );
} catch(error){mkdirSync("tmp/screenshots",{recursive:true});await debugPage?.screenshot({path:"tmp/screenshots/modern-failure.png"});console.log(await debugPage?.locator("body").innerText());throw error;
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  rmSync(directory, { recursive: true, force: true });
}
