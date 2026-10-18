import { FarmError } from "./farm-store.mjs";
import { randomUUID } from "node:crypto";
const collections = new Set(
  "plantationFeatures layers inventoryItems harvestEvents accounts transactions workAssignments employees machinery projects harvestEntries pallets harvestLogs operationalLogs inventoryTransactions employeeGroups dailyLogs nutritionPlans planExecutions forumPosts listings bids reviews alerts purchaseOrders suppliers notes checkpoints systemLogs crops stockTransactions harvestedProduce cropVarieties roles systemSettings conversations messages agronomicLedger _connection_test_".split(
    " ",
  ),
);
const workerReadable = new Set(
  "plantationFeatures layers harvestEvents workAssignments harvestEntries harvestLogs crops cropVarieties notes checkpoints alerts".split(
    " ",
  ),
);
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const copy = (value) => JSON.parse(JSON.stringify(value));
function clean(value, depth = 0) {
  if (depth > 40) throw new FarmError(400, "Document is too deeply nested");
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if(["password","password_hash","newPassword","confirmPassword"].includes(key))continue;
      if (forbidden.has(key)) throw new FarmError(400, "Invalid document key");
      out[key] = clean(v, depth + 1);
    }
    return out;
  }
  return value;
}
function apply(base, input, deep = false) {
  const result = copy(base || {});
  for (const [key, value] of Object.entries(input)) {
    const parts = key.split(".");
    if (parts.some((p) => forbidden.has(p) || !p))
      throw new FarmError(400, "Invalid field path");
    let target = result;
    for (const part of parts.slice(0, -1)) {
      if (
        !target[part] ||
        typeof target[part] !== "object" ||
        Array.isArray(target[part])
      )
        target[part] = {};
      target = target[part];
    }
    const leaf = parts.at(-1);
    target[leaf] =
      value?.type === "increment"
        ? Number(target[leaf] || 0) + Number(value.value)
        : deep && value && typeof value === "object" && !Array.isArray(value)
          ? apply(
              target[leaf] && typeof target[leaf] === "object"
                ? target[leaf]
                : {},
              value,
              true,
            )
          : value;
  }
  return result;
}
export function documentStore(store) {
  const db = store.db;
  db.exec(
    "CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);",
  );
  const profile = (user) => ({
    ...JSON.parse(
      db
        .prepare("SELECT body FROM documents WHERE path=?")
        .get(`users/${user.id}`)?.body || "{}",
    ),
    id: user.id,
    name: user.name,
    email: `${user.username}@local.invalid`,
    globalUniqueId: `LOCAL-${user.id}`,
    individualUniqueId: `LOCAL-${user.id}`,
    activeRole: "company",
    roles: [user.role === "owner" ? "Founder" : "Employee"],
    isGuest: false,
    status: "active",
    verificationStatus: "verified",
    kycStatus: "none",
    isProfileDiscoverable: false,
    isPubliclyVisible: false,
    aiQueryCount: 0,
    createdAt: new Date(0).toISOString(),
    currentOrgId: store.farm().id,
  });
  function virtual(user, col) {
    const farm = store.farm();
    const people = db
      .prepare("SELECT id,name,username,role,active FROM users WHERE active=1")
      .all();
    if (col === "users")
      return people
        .filter((p) => user.role === "owner" || p.id === user.id)
        .map(profile);
    if (col === "organizations")
      return [
        {
          ...JSON.parse(
            db
              .prepare("SELECT body FROM documents WHERE path=?")
              .get(`organizations/${farm.id}`)?.body || "{}",
          ),
          id: farm.id,
          name: farm.name,
          createdBy: people.find((p) => p.role === "owner")?.id,
          type: "Farm",
          country: "Georgia",
          timezone: farm.timezone,
          status: "active",
          isDiscoverable: false,
          subscriptionType: "Local",
          createdAt: new Date(0).toISOString(),
        },
      ];
    if (col === "memberships")
      return people
        .filter((p) => user.role === "owner" || p.id === user.id)
        .map((p) => ({
          id: `local-${p.id}`,
          userId: p.id,
          organizationId: farm.id,
          role: p.role === "owner" ? "Founder" : "Employee",
          status: "active",
          joinedAt: new Date(0).toISOString(),
        }));
    return null;
  }
  function check(user, path, write = false) {
    if (typeof path !== "string" || !/^[-\w]+(?:\/[-\w.]+)?$/.test(path))
      throw new FarmError(400, "Invalid document path");
    const [col] = path.split("/");
    if (["users", "organizations", "memberships"].includes(col)) {
      if (
        write &&
        (col === "memberships" ||
          (col === "organizations" && user.role !== "owner") ||
          (col === "users" &&
            path.split("/")[1] !== user.id &&
            user.role !== "owner"))
      )
        throw new FarmError(
          403,
          "Manage local accounts through the farm server account controls",
        );
      return;
    }
    if (!collections.has(col))
      throw new FarmError(
        403,
        `Collection ${col} is not a local farm collection`,
      );
    if (user.role !== "owner" && (write || !workerReadable.has(col)))
      throw new FarmError(
        403,
        "Farm owner access required for this collection",
      );
  }
  const getPath = (object, path) =>
    path === "__name__"
      ? object.id
      : path.split(".").reduce((v, k) => v?.[k], object);
  return {
    profile,
    read(user, input) {
      const { path } = input;
      check(user, path);
      const parts = path.split("/"),
        v = virtual(user, parts[0]);
      let rows =
        v ||
        db
          .prepare("SELECT path,body,revision FROM documents WHERE path LIKE ?")
          .all(`${parts[0]}/%`)
          .map((r) => ({ ...JSON.parse(r.body), id: r.path.split("/")[1] }));
      if (parts.length === 2) {
        const row = rows.find((r) => r.id === parts[1]);
        return { document: row || null };
      }
      for (const filter of input.constraints || []) {
        if (filter.type === "where") {
          const { field, op, value } = filter;
          rows = rows.filter((row) => {
            const actual = getPath(row, field);
            switch (op) {
              case "==":
                return JSON.stringify(actual) === JSON.stringify(value);
              case "!=":
                return (
                  actual !== undefined &&
                  JSON.stringify(actual) !== JSON.stringify(value)
                );
              case "in":
                return Array.isArray(value) && value.includes(actual);
              case "not-in":
                return Array.isArray(value) && !value.includes(actual);
              case "array-contains":
                return Array.isArray(actual) && actual.includes(value);
              case "array-contains-any":
                return (
                  Array.isArray(actual) &&
                  Array.isArray(value) &&
                  actual.some((v) => value.includes(v))
                );
              case ">":
                return actual > value;
              case ">=":
                return actual >= value;
              case "<":
                return actual < value;
              case "<=":
                return actual <= value;
              default:
                throw new FarmError(400, "Unsupported query operator");
            }
          });
        }
      }
      const orders = (input.constraints || []).filter(
        (c) => c.type === "orderBy",
      );
      if (orders.length)
        rows.sort((a, b) => {
          for (const order of orders) {
            const av = getPath(a, order.field),
              bv = getPath(b, order.field);
            const n = av === bv ? 0 : av > bv ? 1 : -1;
            if (n) return order.dir === "desc" ? -n : n;
          }
          return 0;
        });
      const limit = (input.constraints || []).find((c) => c.type === "limit");
      if (limit)
        rows = rows.slice(
          0,
          Math.max(0, Math.min(Number(limit.n) || 0, 10000)),
        );
      return { documents: rows };
    },
    write(user, input, maxOperations = 500) {
      if (
        !Array.isArray(input.operations) ||
        input.operations.length < 1 ||
        input.operations.length > maxOperations
      )
        throw new FarmError(400, "Provide 1–500 operations");
      const operations = clean(input.operations);
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const operation of operations) {
          check(user, operation.path, true);
          if (operation.path.split("/").length !== 2)
            throw new FarmError(400, "A document ID is required");
          const existing = db
            .prepare("SELECT body FROM documents WHERE path=?")
            .get(operation.path);
          if (
            ["users", "organizations"].includes(operation.path.split("/")[0]) &&
            operation.type === "delete"
          )
            throw new FarmError(403, "Identity deletion uses account controls");
          if (operation.type === "delete") {
            db.prepare("DELETE FROM documents WHERE path=?").run(
              operation.path,
            );
            continue;
          }
          if (
            !["set", "update"].includes(operation.type) ||
            !operation.data ||
            Array.isArray(operation.data) ||
            typeof operation.data !== "object"
          )
            throw new FarmError(400, "Invalid document operation");
          if (
            operation.type === "update" &&
            !existing &&
            !["users", "organizations"].includes(operation.path.split("/")[0])
          )
            throw new FarmError(404, "Document not found");
          let payload = operation.data;
          const kind = operation.path.split("/")[0];
          if (kind === "organizations") {
            if (operation.path.split("/")[1] !== store.farm().id)
              throw new FarmError(403, "This server has one farm workspace");
            payload = Object.fromEntries(
              Object.entries(payload).filter(([key]) =>
                [
                  "name",
                  "legalName",
                  "country",
                  "region",
                  "description",
                  "phone",
                  "address",
                  "logo",
                  "areaGeometry",
                  "center",
                  "area",
                  "agricultureType",
                  "taxNumber",
                ].includes(key),
              ),
            );
            if (payload.name) {
              if (
                typeof payload.name !== "string" ||
                !payload.name.trim() ||
                payload.name.length > 120
              )
                throw new FarmError(400, "Invalid farm name");
              db.prepare("UPDATE farm SET name=? WHERE id=?").run(
                payload.name.trim(),
                store.farm().id,
              );
            }
          }
          if (kind === "users")
            payload = Object.fromEntries(
              Object.entries(payload).filter(([key]) =>
                [
                  "name",
                  "bio",
                  "phone",
                  "avatar",
                  "photoURL",
                  "lastSeen",
                  "lastActive",
                  "isOnline",
                  "language",
                  "currency",
                  "country",
                  "preferences",
                ].includes(key),
              ),
            );
          if (kind === "users" && payload.name) {
            if (
              typeof payload.name !== "string" ||
              !payload.name.trim() ||
              payload.name.length > 120
            )
              throw new FarmError(400, "Invalid user name");
            db.prepare("UPDATE users SET name=? WHERE id=?").run(
              payload.name.trim(),
              operation.path.split("/")[1],
            );
          }
          const previous = existing ? JSON.parse(existing.body) : {};
          const data = apply(
            operation.merge || operation.type === "update" ? previous : {},
            payload,
            operation.type === "set" && operation.merge === true,
          );
          const farm = store.farm();
          if (data.organizationId && data.organizationId !== farm.id)
            throw new FarmError(403, "Document belongs to a different farm");
          data.id = operation.path.split("/")[1];
          data.organizationId = farm.id;
          db.prepare(
            "INSERT INTO documents(path,body,updated_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET body=excluded.body,revision=revision+1,updated_at=excluded.updated_at",
          ).run(operation.path, JSON.stringify(data), new Date().toISOString());
        }
        db.prepare(
          "INSERT INTO audit(at,user_id,action,record_id) VALUES(?,?,?,?)",
        ).run(
          new Date().toISOString(),
          user.id,
          "documents.commit",
          randomUUID(),
        );
        db.exec("COMMIT");
        return { ok: true };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
