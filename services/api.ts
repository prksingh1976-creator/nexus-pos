
import { User } from '../types';

const getBaseUrl = () => {
    try {
        const sessionUser = localStorage.getItem('nexus_pos_user');
        if (sessionUser) {
            const user = JSON.parse(sessionUser);
            if (user.preferences?.apiServerUrl) {
                let url = user.preferences.apiServerUrl.replace(/\/$/, '');
                // Ensure we use HTTPS for GitHub Pages compatibility
                if (window.location.protocol === 'https:' && url.startsWith('http:')) {
                    console.warn("HTTPS site cannot connect to HTTP server. Use Ngrok HTTPS URL.");
                }
                return url;
            }
        }
    } catch (e) {}
    return ''; 
};

export const api = {
    async testConnection(url: string) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 4000); // 4s timeout for tunnels
            const res = await fetch(`${url}/api/health`, { 
                method: 'GET', 
                signal: controller.signal,
                headers: { 'Cache-Control': 'no-cache' }
            });
            clearTimeout(id);
            return res.ok;
        } catch (e) {
            console.error("Connection test failed:", e);
            return false;
        }
    },

    async loadShopData(userId: string) {
        const API_URL = getBaseUrl();
        if (!API_URL) return null;

        try {
            const res = await fetch(`${API_URL}/api/shop/${userId}`);
            if (!res.ok) throw new Error("PC Server unreachable");
            return await res.json();
        } catch (e) {
            console.warn("Home PC Server offline or tunnel expired. Using local browser storage.");
            return null;
        }
    },

    async syncUser(user: User) {
        const API_URL = getBaseUrl();
        if (!API_URL) return;

        try {
            await fetch(`${API_URL}/api/user/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
                keepalive: true
            });
        } catch (e) {}
    },

    async syncData(userId: string, type: string, items: any[]) {
        const API_URL = getBaseUrl();
        if (!API_URL) return;

        try {
            const response = await fetch(`${API_URL}/api/sync/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, items }),
                keepalive: true
            });
            if (!response.ok) throw new Error("Sync failed");
        } catch (e) {
            console.error(`Sync error: Could not reach PC Server for ${type}. Data saved locally only.`);
        }
    }
};
