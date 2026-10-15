import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
let connection: Promise<{
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
}>;
export function cloud() {
  if (!connection)
    connection = (async () => {
      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_MODERN_FIREBASE_EMULATOR === "1" &&
        ["localhost", "127.0.0.1"].includes(location.hostname)
      ) {
        const app =
          getApps().find((a) => a.name === "sonik-ui-test") ||
          initializeApp(
            {
              projectId: "demo-agrimap",
              apiKey: "demo-key",
              authDomain: "localhost",
            },
            "sonik-ui-test",
          );
        const auth = getAuth(app),
          db = getFirestore(app);
        connectAuthEmulator(auth, "http://127.0.0.1:9099");
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
        return { auth, db };
      }
      const { auth, db } = await import("../firebase");
      return { auth, db };
    })();
  return connection;
}
async function profile(name?: string, country = "") {
  const { auth, db } = await cloud(),
    user = auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const ref = doc(db, "users", user.uid),
    existing = await getDoc(ref);
  if (!existing.exists())
    await setDoc(ref, {
      id: user.uid,
      name: name || user.displayName || "Farm member",
      email: user.email,
      roles: ["Guest"],
      activeRole: "individual",
      isGuest: false,
      status: "active",
      globalUniqueId: `G-${user.uid}`,
      individualUniqueId: `I-${user.uid}`,
      createdAt: new Date().toISOString(),
      verificationStatus: "unverified",
      kycStatus: "none",
      isProfileDiscoverable: false,
      isPubliclyVisible: false,
      aiQueryCount: 0,
      tier: "Free",
      isPaid: false,
      subscriptionStatus: "Unpaid",
      country,
    });
  return {
    uid: user.uid,
    name: existing.data()?.name || name || user.displayName || "Farm member",
    email: user.email || "",
  };
}
export async function cloudLogin(email: string, password: string) {
  const { auth } = await cloud();
  await signInWithEmailAndPassword(auth, email, password);
  return profile();
}
export async function cloudRegister(
  name: string,
  email: string,
  password: string,
  country: string,
) {
  const { auth } = await cloud();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(result.user, { displayName: name });
    return await profile(name, country);
  } catch {
    throw new Error(
      "Your cloud account was created, but profile setup is pending. Sign in again when connected to finish setup; do not create a second account.",
    );
  }
}
export async function cloudFarms() {
  const { auth, db } = await cloud();
  if (!auth.currentUser) throw new Error("Sign in again.");
  const result = await getDocs(
    query(
      collection(db, "organizations"),
      where("createdBy", "==", auth.currentUser.uid),
      limit(100),
    ),
  );
  return result.docs.map((d) => ({
    id: d.id,
    name: String(d.data().name || "Farm workspace"),
  }));
}
export async function cloudLogout() {
  await signOut((await cloud()).auth);
}
