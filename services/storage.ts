import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface NexusDB extends DBSchema {
  keyval: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'nexus-pos-db';
const STORE_NAME = 'keyval';

let dbPromise: Promise<IDBPDatabase<NexusDB>>;

if (typeof window !== 'undefined') {
    dbPromise = openDB<NexusDB>(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME);
        },
    });
}

export const storage = {
  async get<T = any>(key: string): Promise<T | undefined> {
    if (!dbPromise) return undefined;
    return (await dbPromise).get(STORE_NAME, key);
  },
  async set(key: string, val: any): Promise<void> {
    if (!dbPromise) return;
    return (await dbPromise).put(STORE_NAME, val, key);
  },
  async del(key: string): Promise<void> {
    if (!dbPromise) return;
    return (await dbPromise).delete(STORE_NAME, key);
  },
  async clear(): Promise<void> {
    if (!dbPromise) return;
    return (await dbPromise).clear(STORE_NAME);
  },
  async keys(): Promise<string[]> {
      if (!dbPromise) return [];
      return (await dbPromise).getAllKeys(STORE_NAME) as Promise<string[]>;
  }
};