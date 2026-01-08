import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import * as firestore from "firebase/firestore";

// Destructure required functions from the namespace to avoid named export resolution issues
const { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, deleteDoc } = firestore;

let app: FirebaseApp | undefined;
let db: any | undefined;
let auth: any | undefined;

export const isFirebaseInitialized = () => !!app;

export const initializeFirebase = (config: any) => {
    try {
        if (!getApps().length) {
            app = initializeApp(config);
        } else {
            app = getApp();
        }
        db = getFirestore(app);
        auth = getAuth(app);
        // Enable local persistence for auth
        setPersistence(auth, browserLocalPersistence).catch((error) => {
            console.error("Auth Persistence Error:", error);
        });
        
        return true;
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        return false;
    }
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    const provider = new GoogleAuthProvider();
    // Using popup. For mobile PWA, redirect might be better but popup works in modern Android/iOS if context is correct.
    const result = await signInWithPopup(auth, provider);
    return result.user;
};

export const logoutFromCloud = async () => {
    if (!auth) return;
    await signOut(auth);
};

// Sync Data Helpers
export const subscribeToCollection = (userId: string, collectionName: string, callback: (data: any) => void) => {
    if (!db) return () => {};
    // Structure: /shops/{userId}/data/{collectionName}
    const docRef = doc(db, 'shops', userId, 'data', collectionName);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Check if 'items' key exists, otherwise data might be the object itself
            if (data && Array.isArray(data.items)) {
                callback(data.items);
            } else {
                callback(data); // Fallback
            }
        } else {
            callback(null); // No data yet
        }
    }, (error) => {
        console.error(`Snapshot error for ${collectionName}:`, error);
    });
    
    return unsubscribe;
};

export const saveToCloud = async (userId: string, collectionName: string, data: any) => {
    if (!db) return;
    try {
        const docRef = doc(db, 'shops', userId, 'data', collectionName);
        // Saving as { items: [] } to avoid document field limits with array indexing, though size limit still applies.
        await setDoc(docRef, { items: data }, { merge: true });
    } catch (e) {
        console.error(`Error saving ${collectionName} to cloud:`, e);
    }
};

export const saveUserProfile = async (userId: string, profile: any) => {
    if (!db) return;
    try {
        const docRef = doc(db, 'shops', userId);
        await setDoc(docRef, { profile }, { merge: true });
    } catch (e) {
        console.error("Error saving profile:", e);
    }
};

export const deleteUserData = async (userId: string) => {
    if (!db) return;
    try {
        const collections = ['products', 'customers', 'transactions', 'categories', 'tags', 'chargerules'];
        for (const col of collections) {
             const docRef = doc(db, 'shops', userId, 'data', col);
             await deleteDoc(docRef);
        }
        // Delete profile
        await deleteDoc(doc(db, 'shops', userId));
    } catch (e) {
        console.error("Error deleting cloud data:", e);
        throw e;
    }
};