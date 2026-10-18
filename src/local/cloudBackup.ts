import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  writeBatch,
  connectFirestoreEmulator,
  getDocs,
  collection,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
export async function uploadCloudBackup(
  snapshot: any,
  email: string,
  password: string,
  downloadFarm?: string,
) {
  const emulator =
    import.meta.env.DEV &&
    import.meta.env.VITE_MODERN_FIREBASE_EMULATOR === "1" &&
    ["localhost", "127.0.0.1"].includes(location.hostname);
  const config = emulator
    ? { projectId: "demo-agrimap", apiKey: "demo-key", authDomain: "localhost" }
    : import.meta.env.VITE_FIREBASE_API_KEY
      ? {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        }
      : firebaseConfig;
  const app = initializeApp(config, `manual-backup-${crypto.randomUUID()}`),
    auth = getAuth(app);
  const databaseId = emulator
    ? "(default)"
    : import.meta.env.VITE_FIRESTORE_DATABASE_ID ||
      (firebaseConfig as any).firestoreDatabaseId ||
      (config.projectId?.startsWith("gen-lang-client")
        ? "ai-studio-42204e0d-ec5c-4889-b8f7-38d7bcdb9a9d"
        : "(default)");
  const db = getFirestore(app, databaseId);
  if (emulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099");
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  try {
    await setPersistence(auth, inMemoryPersistence);
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (downloadFarm) {
      const listing = await getDocs(
        collection(db, `localBackups/${user.uid}/snapshots`),
      );
      const latest = listing.docs
        .map((d) => d.data())
        .filter((d) => d.farmId === downloadFarm && d.status === "complete")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest)
        throw new Error(
          "No completed backup found for this farm in this cloud account.",
        );
      if (
        !Number.isInteger(latest.chunks) ||
        latest.chunks < 1 ||
        latest.chunks > 450
      )
        throw new Error("Backup manifest exceeds the supported size.");
      const chunks = await getDocs(
        collection(
          db,
          `localBackups/${user.uid}/snapshots/${latest.id}/chunks`,
        ),
      );
      const parts = chunks.docs
        .map((d) => d.data())
        .sort((a, b) => a.index - b.index);
      if (
        parts.length !== latest.chunks ||
        parts.some((p, i) => p.index !== i || typeof p.data !== "string")
      )
        throw new Error("Backup is incomplete.");
      const json = parts.map((p) => p.data).join("");
      const bytes = new TextEncoder().encode(json);
      if (bytes.length > 64 * 1024 * 1024)
        throw new Error("Backup exceeds the supported size.");
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== latest.sha256) throw new Error("Backup checksum failed.");
      const content = JSON.parse(json);
      if (
        content.farm?.id !== downloadFarm ||
        content.format !== "agrimap-farm-data" ||
        content.version !== 2
      )
        throw new Error("Backup does not match this farm.");
      return { id: latest.id, documents: content.documents?.length || 0, json };
    }
    const json = JSON.stringify(snapshot),
      hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json)),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    if (new TextEncoder().encode(json).length > 64 * 1024 * 1024)
      throw new Error(
        "Backup exceeds 64 MB. Use the full SQLite backup command.",
      );
    const id = crypto.randomUUID(),
      base = `localBackups/${user.uid}/snapshots/${id}`,
      chunks = Math.ceil(json.length / 150000);
    const manifest = {
      id,
      farmId: snapshot.farm.id,
      farmName: snapshot.farm.name,
      createdAt: new Date().toISOString(),
      status: "uploading",
      chunks,
      sha256: hash,
      format: "agrimap-farm-data",
      version: 2,
    };
    await setDoc(doc(db, base), manifest);
    for (let i = 0; i < chunks; i += 100) {
      const batch = writeBatch(db);
      for (let n = i; n < Math.min(i + 100, chunks); n++)
        batch.set(doc(db, `${base}/chunks/${n}`), {
          index: n,
          data: json.slice(n * 150000, (n + 1) * 150000),
        });
      await batch.commit();
    }
    await setDoc(doc(db, base), { ...manifest, status: "complete" });
    return { id, documents: snapshot.documents?.length || 0 };
  } finally {
    await signOut(auth).catch(() => {});
    await deleteApp(app);
  }
}
