import { User } from '../types';

// Safely determine production environment
const env = (import.meta as any).env;
const isProd = env ? env.PROD : false;
const API_URL = isProd ? '' : '/api'; 

export const api = {
    async loadShopData(userId: string) {
        try {
            const res = await fetch(`${API_URL}/api/shop/${userId}`);
            if (!res.ok) throw new Error("Server offline");
            return await res.json();
        } catch (e) {
            console.warn("API Load Failed, falling back to LocalStorage", e);
            return null; // Context will handle fallback
        }
    },

    async syncUser(user: User) {
        try {
            await fetch(`${API_URL}/api/user/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
                keepalive: true
            });
        } catch (e) {
            // Silent fail - will sync next time
        }
    },

    async syncData(userId: string, type: 'products' | 'customers' | 'transactions', items: any[]) {
        try {
            await fetch(`${API_URL}/api/sync/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, items }),
                keepalive: true
            });
        } catch (e) {
            console.warn(`Failed to sync ${type} to server.`);
        }
    },

    async syncMetadata(userId: string, key: string, value: any[]) {
        try {
            await fetch(`${API_URL}/api/metadata/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, key, value }),
                keepalive: true
            });
        } catch (e) {
            console.warn(`Failed to sync ${key} to server.`);
        }
    }
};