import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, Firestore, collection } from "firebase/firestore";

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
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
            callback(docSnap.data().items);
        } else {
            callback(null); // No data yet
        }
    });
    
    return unsubscribe;
};

export const subscribeToProfile = (userId: string, callback: (profile: any) => void) => {
    if (!db) return () => {};
    const docRef = doc(db, 'shops', userId);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().profile);
        }
    });
};

export const saveToCloud = async (userId: string, collectionName: string, data: any) => {
    if (!db) return;
    try {
        const docRef = doc(db, 'shops', userId, 'data', collectionName);
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

export const getUserProfile = async (userId: string) => {
    if (!db) return null;
    const docRef = doc(db, 'shops', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return snap.data().profile;
    }
    return null;
};