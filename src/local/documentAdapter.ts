import { localRequest } from "./runtime";
type Reference = {
  path: string;
  id?: string;
  constraints?: any[];
  type?: string;
};
const listeners = new Set<() => void>();
const pending = new Set<Promise<any>>();
export const awaitLocalWrites = () => Promise.all([...pending]);
const ref = (path: string): Reference => ({
  path,
  id: path.split("/").at(-1),
  type: "document",
});
const snapshot = (path: string, data: any) => ({
  id: path.split("/").at(-1),
  ref: ref(path),
  exists: () => data !== null,
  data: () => data,
  metadata: { fromCache: false },
});
export const localDoc = (path: string, id: string) => ref(`${path}/${id}`);
export const localCollection = (path: string): Reference => ({
  path,
  type: "collection",
});
export const localQuery = (source: Reference, ...constraints: any[]) => ({
  ...source,
  constraints: [...(source.constraints || []), ...constraints],
});
export async function localGet(source: Reference) {
  const result = await localRequest("documents/read", {
    path: source.path,
    constraints: source.constraints,
  });
  if ("document" in result) return snapshot(source.path, result.document);
  const docs = result.documents.map((data: any) =>
    snapshot(`${source.path}/${data.id}`, data),
  );
  return {
    docs,
    empty: !docs.length,
    size: docs.length,
    forEach: (cb: any) => docs.forEach(cb),
    metadata: { fromCache: false },
  };
}
export async function localCommit(operations: any[]) {
  const request = localRequest("documents/commit", { operations });
  pending.add(request);
  try {
    await request;
  } finally {
    pending.delete(request);
    listeners.forEach((refresh) => refresh());
  }
}
export const localSet = (reference: Reference, data: any, options?: any) =>
  localCommit([
    { type: "set", path: reference.path, data, merge: options?.merge === true },
  ]);
export const localUpdate = (reference: Reference, data: any) =>
  localCommit([{ type: "update", path: reference.path, data }]);
export const localDelete = (reference: Reference) =>
  localCommit([{ type: "delete", path: reference.path }]);
export async function localAdd(reference: Reference, data: any) {
  const target = localDoc(reference.path, crypto.randomUUID());
  await localSet(target, data);
  return target;
}
export function localSubscribe(
  source: Reference,
  callback: any,
  onError?: any,
) {
  let active = true,
    running = false;
  let last = "";
  const refresh = async () => {
    if (!active || running) return;
    running = true;
    try {
      const result = await localGet(source);
      const serialized = JSON.stringify(
        "docs" in result
          ? result.docs.map((d: any) => d.data())
          : result.data(),
      );
      if (active && last !== serialized) {
        last = serialized;
        callback(result);
      }
    } catch (error) {
      if (active) {try{onError?.(error);}catch(callbackError){console.error("Local subscription error handler failed",callbackError);}}
    } finally {
      running = false;
    }
  };
  const notify=()=>{last="";void refresh();};
  listeners.add(notify);
  refresh();
  const interval = setInterval(refresh, 5000);
  return () => {
    active = false;
    clearInterval(interval);
    listeners.delete(notify);
  };
}
export function localBatch() {
  const operations: any[] = [];
  const batch = {
    set: (r: Reference, data: any, options?: any) => {
      operations.push({
        type: "set",
        path: r.path,
        data,
        merge: options?.merge === true,
      });
      return batch;
    },
    update: (r: Reference, data: any) => {
      operations.push({ type: "update", path: r.path, data });
      return batch;
    },
    delete: (r: Reference) => {
      operations.push({ type: "delete", path: r.path });
      return batch;
    },
    commit: () => localCommit(operations),
  };
  return batch;
}
