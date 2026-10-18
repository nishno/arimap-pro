import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080"
)
  throw Error("Run only with local Firebase emulators");
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
  "backup-fixture",
);
const auth = getAuth(app),
  db = getFirestore(app);
await auth.createUser({
  uid: "backup-owner",
  email: "backup-owner@example.test",
  password: "test-only-long-password",
});
await auth.createUser({
  uid: "backup-other",
  email: "backup-other@example.test",
  password: "test-only-long-password",
});
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
    stdio: "ignore",
  },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3004")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.route("**/*", (r) =>
    [
      "http://127.0.0.1:3004",
      "http://127.0.0.1:9099",
      "http://127.0.0.1:8080",
    ].includes(new URL(r.request().url()).origin)
      ? r.continue()
      : r.abort(),
  );
  await page.goto("http://127.0.0.1:3004/demo");
  const snapshot = {
    format: "agrimap-farm-data",
    version: 2,
    farm: { id: "test-farm", name: "ქართული მეურნეობა" },
    documents: [
      {
        path: "inventoryItems/one",
        body: { name: "ქართული მოცვი", quantity: 25 },
      },
    ],
  };
  const result = await page.evaluate(async (snapshot) => {
    const { uploadCloudBackup } = await import("/src/local/cloudBackup.ts");
    const uploaded = await uploadCloudBackup(
      snapshot,
      "backup-owner@example.test",
      "test-only-long-password",
    );
    const downloaded = await uploadCloudBackup(
      null,
      "backup-owner@example.test",
      "test-only-long-password",
      snapshot.farm.id,
    );
    let isolated = false;
    try {
      await uploadCloudBackup(
        null,
        "backup-other@example.test",
        "test-only-long-password",
        snapshot.farm.id,
      );
    } catch {
      isolated = true;
    }
    return { uploaded, downloaded, isolated };
  }, snapshot);
  assert.equal(result.downloaded.json, JSON.stringify(snapshot));
  assert.equal(result.uploaded.id, result.downloaded.id);
  assert(result.isolated);
  const manifests = await db
    .collection("localBackups/backup-owner/snapshots")
    .get();
  assert.equal(manifests.size, 1);
  assert.equal(manifests.docs[0].data().status, "complete");
  assert(
    !(await db.collection("organizations").get()).size,
    "Backup wrote operational cloud data",
  );
  await manifests.docs[0].ref
    .collection("chunks")
    .doc("0")
    .update({ data: "corrupt" });
  const integrity = await page.evaluate(async () => {
    try {
      await (
        await import("/src/local/cloudBackup.ts")
      ).uploadCloudBackup(
        null,
        "backup-owner@example.test",
        "test-only-long-password",
        "test-farm",
      );
      return false;
    } catch (e) {
      return e.message.includes("checksum");
    }
  });
  assert(integrity);
  console.log(
    "PASS: explicit Firebase snapshot upload/download, Unicode roundtrip, private account isolation, complete-manifest semantics, no operational cloud writes and checksum rejection.",
  );
} finally {
  if (browser) await browser.close();
  vite.kill("SIGTERM");
  await new Promise((r) =>
    vite.exitCode !== null ? r() : vite.once("exit", r),
  );
}
