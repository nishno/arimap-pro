import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
)
  throw Error("Local Auth/Firestore emulators required");
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const app = initializeApp(
  {
    projectId: "demo-agrimap",
    credential: cert({
      projectId: "demo-agrimap",
      clientEmail: "test@demo-agrimap.iam.gserviceaccount.com",
      privateKey,
    }),
  },
  "modern-test",
);
const auth = getAuth(app),
  db = getFirestore(app),
  password = "test-only-long-password";
const retained = {
  id: "existing-modern",
  name: "Existing grower",
  roles: ["Guest"],
  tier: "Free",
  isPaid: false,
  customPreference: "retain-me",
};
await auth.createUser({
  uid: retained.id,
  email: "existing-modern@example.test",
  password,
});
await db.doc(`users/${retained.id}`).set(retained);
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "3004",
    "--strictPort",
  ],
  {
    env: { ...process.env, VITE_MODERN_FIREBASE_EMULATOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
vite.stdout.on("data", (d) => (logs += d));
vite.stderr.on("data", (d) => (logs += d));
let browser;
try {
  const origin = "http://127.0.0.1:3004";
  for (let i = 0; i < 100; i++) {
    if (vite.exitCode !== null) throw Error(logs);
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  const context = await browser.newContext();
  await context.route("**/*", (r) =>
    [
      "http://127.0.0.1:3004",
      "http://127.0.0.1:9099",
      "http://127.0.0.1:8080",
    ].includes(new URL(r.request().url()).origin)
      ? r.continue()
      : r.abort(),
  );
  const page = await context.newPage();
  await page.goto(origin + "/modern-preview/register");
  await page.getByRole("button", { name: "Cloud", exact: true }).click();
  await page.getByLabel("Your name", { exact: true }).fill("New grower");
  await page.getByLabel("Email address").fill("new-modern@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create cloud account", exact: true })
    .click();
  await page
    .getByText("Cloud account connected", { exact: true })
    .waitFor({ timeout: 30000 });
  const created = await auth.getUserByEmail("new-modern@example.test"),
    profile = (await db.doc(`users/${created.uid}`).get()).data();
  assert.deepEqual(profile.roles, ["Guest"]);
  assert.equal(profile.isPaid, false);
  assert.equal(profile.tier, "Free");
  assert(!created.customClaims?.admin);
  assert.equal(profile.name, "New grower");
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByText("Guest preview", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Cloud", exact: true }).click();
  await page.getByLabel("Email address").fill("existing-modern@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByText("Cloud account connected", { exact: true }).waitFor();
  assert.deepEqual(
    (await db.doc(`users/${retained.id}`).get()).data(),
    retained,
  );
  console.log(
    "PASS: Modern cloud registration/sign-in against real Auth and Firestore emulators, free unprivileged profile, sign-out and retained existing profile.",
  );
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
  await new Promise((resolve) =>
    vite.exitCode !== null ? resolve() : vite.once("exit", resolve),
  );
}
