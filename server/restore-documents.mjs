import { readFileSync, existsSync } from "node:fs";
import { backup } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openFarm, FarmError } from "./farm-store.mjs";
import { documentStore } from "./documents.mjs";
export async function restoreDocuments(directory, snapshot, confirmedFarm) {
  if (!existsSync(path.join(directory, "farm.sqlite")))
    throw new FarmError(
      400,
      "Initialize or recover the local server identity first",
    );
  const store = openFarm(directory);
  try {
    const farm = store.farm();
    if (
      !farm ||
      confirmedFarm !== farm.id ||
      snapshot?.farm?.id !== farm.id ||
      snapshot.format !== "agrimap-farm-data" ||
      snapshot.version !== 2 ||
      !Array.isArray(snapshot.documents)
    )
      throw new FarmError(
        400,
        "Backup and explicit confirmation must match this farm",
      );
    const owner = store.db
      .prepare(
        "SELECT id,name,username,role FROM users WHERE role='owner' AND active=1",
      )
      .get();
    if (!owner) throw new FarmError(400, "Recover the server owner first");
    const docs = documentStore(store);
    const operations = snapshot.documents.map((row) => ({
      type: "set",
      path: row.path,
      data: row.body,
    }));
    const recovery = path.join(
      directory,
      `before-document-restore-${Date.now()}.sqlite`,
    );
    await backup(store.db, recovery);
    // One transaction: replacing the complete document set must never partially succeed.
    const current = store.db.prepare("SELECT path FROM documents").all();
    const incoming = new Set(operations.map((o) => o.path));
    const deletes = current
      .filter(
        (r) =>
          !incoming.has(r.path) &&
          !r.path.startsWith("users/") &&
          !r.path.startsWith("organizations/"),
      )
      .map((r) => ({ type: "delete", path: r.path }));
    if (operations.length + deletes.length)
      docs.write(owner, { operations: [...deletes, ...operations] }, 1000000);
    return { restored: operations.length, recovery };
  } finally {
    store.close();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const args = process.argv.slice(2),
      file = args[args.indexOf("--file") + 1],
      farm = args[args.indexOf("--confirm-farm") + 1];
    if (!args.includes("--file") || !args.includes("--confirm-farm"))
      throw new Error(
        "Use --file backup.json --confirm-farm exact-farm-id. Stop the farm server first.",
      );
    const directory =
      process.env.LOCAL_DATA_DIR ||
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../.local-data",
      );
    const result = await restoreDocuments(
      directory,
      JSON.parse(readFileSync(file, "utf8")),
      farm,
    );
    console.log(
      `Restored ${result.restored} document records. Pre-restore recovery copy: ${result.recovery}. Accounts and legacy field/harvest tables were retained.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
