# Nexus POS & Shop Manager 🏪 (Hybrid Edition)

This is a modern POS system designed to run on **GitHub Pages** while storing data securely on **your local PC**.

## 🏗️ Hybrid Architecture

1.  **Frontend (UI):** Hosted on GitHub Pages.
2.  **Backend (Storage):** A Node.js server running on your home/shop PC.
3.  **Secure Tunnel:** Ngrok (connects GitHub to your PC).

---

## 🚀 Setup Guide

### 1. Run the Server on your PC
1.  Install Node.js.
2.  Save the `nexus-server.js` script (provided in the guide) to a folder.
3.  Install dependencies: `npm install express cors`
4.  Run it: `node nexus-server.js`
5.  Install **Ngrok** and run: `ngrok http 3001`
6.  Copy the **HTTPS** URL provided by Ngrok.

### 2. Deploy the Website to GitHub
1.  Push your code to a GitHub repository.
2.  In your terminal, run: `npm run deploy`
3.  Your app will be live at `https://yourusername.github.io/your-repo-name/`.

### 3. Link the Two
1.  Open your GitHub Pages URL.
2.  Go to **Settings > Account**.
3.  Paste your **Ngrok HTTPS URL** into the **Backend API Server URL** field.
4.  Click **Test** then **Save Changes**.

---

## ✨ Features
*   **Zero Cloud Costs:** No expensive database hosting needed; data stays on your hardware.
*   **Privacy:** Customer and credit records never leave your physical computer.
*   **Remote Access:** Access your shop dashboard from anywhere in the world while your PC is on.

---

## 🛠️ Tech Stack
*   **Frontend:** React 19, Tailwind CSS.
*   **AI:** Google Gemini (Invoice Scanning & Business Insights).
*   **Local Backend:** Node.js + Express.
