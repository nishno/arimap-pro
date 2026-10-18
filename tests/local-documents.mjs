import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { openFarm } from "../server/farm-store.mjs";
import { restoreDocuments } from "../server/restore-documents.mjs";
import { documentStore } from "../server/documents.mjs";
test("full local document store: durable writes, role boundary, transactions, transformations, queries and identity protection", async () => {
  const dir = mkdtempSync("/tmp/agrimap-docs-");
  let store = openFarm(dir);
  try {
    await store.initialize({
      name: "Guria",
      timezone: "Asia/Tbilisi",
      ownerName: "Owner",
      ownerUsername: "owner",
      password: "test-only-long-password",
    });
    const owner = (await store.login("owner", "test-only-long-password")).user;
    const worker = await store.createWorker(owner, {
      name: "Worker",
      username: "worker",
      password: "test-worker-long-password",
    });
    let docs = documentStore(store);
    const farm = store.farm();
    const commit = (operations, user = owner) =>
      docs.write(user, { operations });
    const read = (path, user = owner, constraints = []) =>
      docs.read(user, { path, constraints });
    assert.equal(read("organizations").documents[0].id, farm.id);
    commit([
      {
        type: "set",
        path: "employees/credentials-test",
        data: { name: "Worker record", password: "test-only-not-for-storage" },
      },
    ]);
    assert.equal(
      read("employees/credentials-test").document.password,
      undefined,
    );
    commit([
      {
        type: "set",
        path: `organizations/${farm.id}`,
        merge: true,
        data: {
          country: "Italy",
          shareholders: [{ name: "Owner", share: 100 }],
          createdBy: "forged-owner",
        },
      },
    ]);
    assert.equal(read("organizations").documents[0].country, "Italy");
    assert.equal(read("organizations").documents[0].shareholders[0].share, 100);
    assert.equal(read("organizations").documents[0].createdBy, owner.id);
    commit([
      {
        type: "set",
        path: "agronomistDiagnoses/one",
        data: { title: "Saved diagnosis", organizationId: farm.id },
      },
    ]);
    assert.equal(
      read("agronomistDiagnoses/one").document.title,
      "Saved diagnosis",
    );
    assert.equal(docs.profile(owner).isGuest, false);
    assert.deepEqual(docs.profile(owner).roles, ["Founder"]);
    for (const col of [
      "plantationFeatures",
      "inventoryItems",
      "workAssignments",
      "accounts",
      "transactions",
      "harvestEvents",
      "employees",
      "nutritionPlans",
      "notes",
      "crops",
    ])
      commit([
        {
          type: "set",
          path: `${col}/one`,
          data: { name: col, quantity: 2, organizationId: farm.id },
        },
      ]);
    commit([
      {
        type: "update",
        path: "inventoryItems/one",
        data: {
          quantity: { type: "increment", value: 3 },
          "details.unit": "kg",
        },
      },
    ]);
    assert.equal(read("inventoryItems/one").document.quantity, 5);
    assert.equal(read("inventoryItems/one").document.details.unit, "kg");
    assert.equal(
      read("inventoryItems", owner, [
        { type: "where", field: "quantity", op: ">=", value: 5 },
        { type: "orderBy", field: "name", dir: "asc" },
        { type: "limit", n: 1 },
      ]).documents.length,
      1,
    );
    assert.throws(
      () =>
        commit([
          { type: "set", path: "notes/two", data: { name: "rollback" } },
          {
            type: "set",
            path: "notes/foreign",
            data: { organizationId: "other-farm" },
          },
        ]),
      (e) => e.status === 403,
    );
    assert.equal(read("notes/two").document, null);
    assert.throws(
      () =>
        commit([
          { type: "set", path: "platformAccess/owner", data: { owner: true } },
        ]),
      (e) => e.status === 403,
    );
    assert.throws(
      () =>
        commit(
          [
            {
              type: "set",
              path: "inventoryItems/two",
              data: { name: "unauthorized" },
            },
          ],
          worker,
        ),
      (e) => e.status === 403,
    );
    assert.throws(
      () => read("accounts", worker),
      (e) => e.status === 403,
    );
    assert.equal(read("plantationFeatures", worker).documents.length, 1);
    commit([
      {
        type: "set",
        path: `users/${worker.id}`,
        data: { roles: ["ROOT_SUPER_ADMIN"], name: "Safe worker" },
      },
    ]);
    assert.deepEqual(read(`users/${worker.id}`).document.roles, ["Employee"]);
    assert.throws(
      () =>
        commit([
          {
            type: "set",
            path: "memberships/forged",
            data: { role: "Founder" },
          },
        ]),
      (e) => e.status === 403,
    );
    commit([{ type: "delete", path: "notes/one" }]);
    assert.equal(read("notes/one").document, null);
    const snapshot = store.exportData(owner);
    assert.equal(snapshot.version, 2);
    assert(snapshot.documents.some((d) => d.path === "inventoryItems/one"));
    assert(!JSON.stringify(snapshot).includes("password_hash"));
    store.close();
    store = openFarm(dir);
    docs = documentStore(store);
    assert.equal(
      docs.read(owner, { path: "inventoryItems/one" }).document.quantity,
      5,
    );
    docs.write(owner, {
      operations: [
        { type: "set", path: "notes/newer", data: { name: "After backup" } },
      ],
    });
    store.close();
    await assert.rejects(restoreDocuments(dir, snapshot, "wrong-farm"));
    await restoreDocuments(dir, snapshot, farm.id);
    store = openFarm(dir);
    docs = documentStore(store);
    assert.equal(docs.read(owner, { path: "notes/newer" }).document, null);
    assert.equal(
      docs.read(owner, { path: "inventoryItems/one" }).document.quantity,
      5,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
