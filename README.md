# Nexus POS & Shop Manager 🏪

**Nexus POS** is a modern, offline-first React application designed for small to medium-sized retail shops. It combines traditional Point of Sale functionality with AI-powered insights, inventory management, and customer credit tracking.

![Status](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Tech-React_%7C_TypeScript_%7C_Tailwind-blue)
![AI](https://img.shields.io/badge/AI-Google_Gemini-purple)

## 🚀 Getting Started (Run Locally)

You have already installed the dependencies. Follow these steps to start the app:

1.  **Configure API Key**:
    Create a file named `.env` in the root folder and add your Google Gemini API key:
    ```env
    VITE_API_KEY=your_key_here
    ```

2.  **Start the Server**:
    Run the following command:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Visit the URL shown in the terminal (usually `http://localhost:5173`).

---

## ✨ Key Features

### 🛒 Point of Sale (POS)
*   **Fast Checkout:** Quick add-to-cart interface with category filtering.
*   **UPI & Credit:** Support for Cash, Store Credit (Udhaar), and UPI QR codes.

### 📦 Inventory
*   **AI Invoice Scanning:** Upload a bill photo, and AI extracts items automatically.
*   **Smart Restock:** AI suggests what to buy based on stock levels.

### 👥 Customer Credit Management
*   **Debtor Tracking:** Filter customers by "Debtors Only" to see who owes money.
*   **Ledger:** Track every credit transaction and payment settlement.

### ☁️ Data Sync
*   **Offline First:** Works locally by default.
*   **Cloud Sync:** Optional Firebase integration for multi-device support.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **AI:** Google GenAI SDK (`@google/genai`)
*   **Build:** Vite

## 📄 License

This project is open source and available under the [MIT License](LICENSE).