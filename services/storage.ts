import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface NexusDB extends DBSchema {
  keyval: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'nexus-pos-db';
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBPDatabase<NexusDB>> | null = null;

if (typeof window !== 'undefined') {
    try {
        dbPromise = openDB<NexusDB>(DB_NAME, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME);
            },
        });
        dbPromise.catch(e => {
            console.warn("IndexedDB Open Failed (Private Mode?):", e);
            dbPromise = null;
        });
    } catch (e) {
        console.warn("IndexedDB Initialization Error:", e);
        dbPromise = null;
    }
}

export const storage = {
  async get<T = any>(key: string): Promise<T | undefined> {
    if (!dbPromise) return undefined;
    try {
        return (await dbPromise).get(STORE_NAME, key);
    } catch (e) {
        return undefined;
    }
  },
  async set(key: string, val: any): Promise<void> {
    if (!dbPromise) return;
    try {
        return (await dbPromise).put(STORE_NAME, val, key);
    } catch (e) {
        console.warn("IDB Set Error:", e);
    }
  },
  async del(key: string): Promise<void> {
    if (!dbPromise) return;
    try {
        return (await dbPromise).delete(STORE_NAME, key);
    } catch (e) {
        console.warn("IDB Delete Error:", e);
    }
  },
  async clear(): Promise<void> {
    if (!dbPromise) return;
    try {
        return (await dbPromise).clear(STORE_NAME);
    } catch (e) {
         console.warn("IDB Clear Error:", e);
    }
  },
  async keys(): Promise<string[]> {
      if (!dbPromise) return [];
      try {
          return (await dbPromise).getAllKeys(STORE_NAME) as Promise<string[]>;
      } catch (e) {
          return [];
      }
  }
};