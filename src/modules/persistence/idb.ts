const DB_NAME = "i0i0";
const DB_VERSION = 1;

const META_KEY = "snapshot";

let dbInstance: IDBDatabase | null = null;
let openPromise: Promise<IDBDatabase> | null = null;

/** Reuses one connection for the session; reopens after close or version change. */
const getDb = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!openPromise) {
    openPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => {
        openPromise = null;
        reject(req.error ?? new Error("IndexedDB open failed"));
      };
      req.onsuccess = () => {
        const db = req.result;
        dbInstance = db;
        openPromise = null;
        db.onversionchange = () => {
          db.close();
          dbInstance = null;
        };
        db.onclose = () => {
          dbInstance = null;
        };
        resolve(db);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
        if (!db.objectStoreNames.contains("blobs")) {
          db.createObjectStore("blobs");
        }
      };
    });
  }
  return openPromise;
};

export const idbGetMeta = async (): Promise<unknown> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readonly");
    const req = tx.objectStore("meta").get(META_KEY);
    req.onerror = () => reject(req.error ?? new Error("meta read failed"));
    req.onsuccess = () => resolve(req.result);
  });
};

export const idbPutMeta = async (value: unknown): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("meta", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("meta write failed"));
    tx.objectStore("meta").put(value, META_KEY);
  });
};

export const idbPutBlob = async (id: string, data: ArrayBuffer): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("blob write failed"));
    tx.objectStore("blobs").put(data, id);
  });
};

export const idbHasBlob = async (id: string): Promise<boolean> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readonly");
    const req = tx.objectStore("blobs").getKey(id);
    req.onerror = () => reject(req.error ?? new Error("blob key read failed"));
    req.onsuccess = () => resolve(req.result !== undefined);
  });
};

export const idbGetBlob = async (id: string): Promise<ArrayBuffer | undefined> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readonly");
    const req = tx.objectStore("blobs").get(id);
    req.onerror = () => reject(req.error ?? new Error("blob read failed"));
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
  });
};

export const idbGetAllBlobKeys = async (): Promise<string[]> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readonly");
    const req = tx.objectStore("blobs").getAllKeys();
    req.onerror = () => reject(req.error ?? new Error("blob keys read failed"));
    req.onsuccess = () => resolve(req.result as string[]);
  });
};

export const idbDeleteBlob = async (id: string): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("blob delete failed"));
    tx.objectStore("blobs").delete(id);
  });
};

export const idbClearAppData = async (): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb clear failed"));
    tx.objectStore("meta").clear();
    tx.objectStore("blobs").clear();
  });
};
