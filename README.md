# Nexus POS & Shop Manager 🏪

**Nexus POS** is a modern, offline-first React application designed for small to medium-sized retail shops. It combines traditional Point of Sale functionality with AI-powered insights, inventory management, and customer credit tracking.

![Status](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Tech-React_%7C_TypeScript_%7C_Tailwind-blue)
![AI](https://img.shields.io/badge/AI-Google_Gemini-purple)
![Hosting](https://img.shields.io/badge/Hosting-GitHub_Pages-orange)

## ✨ Key Features

### 🛒 Point of Sale (POS)
*   **Fast Checkout:** Quick add-to-cart interface with category filtering and search.
*   **Multiple Payment Methods:** Support for Cash, Store Credit (Customer Ledger), and UPI.
*   **UPI QR Generation:** Generates dynamic QR codes for transaction amounts instantly.
*   **Custom Charges:** Toggle taxes (GST/VAT), service fees, or discounts on the fly.
*   **Mobile Friendly:** Responsive cart view for mobile devices.

### 📦 Inventory Management
*   **Product Variants:** Automatically groups products with the same name (e.g., "Milk" -> 500ml, 1L).
*   **AI Invoice Scanning:** Upload a photo of a supplier bill, and Gemini AI extracts product details automatically.
*   **Low Stock Alerts:** Visual indicators for items below minimum stock levels.
*   **Smart Restock:** AI analyzes inventory to suggest what to buy next.

### 👥 Customer & Credit (Udhaar) Management
*   **Digital Ledger:** Track customer debts and store credits.
*   **History:** View detailed transaction history per customer.
*   **Settlement:** Easy workflow to settle debts or lend credit.

### 🧠 AI Intelligence (Powered by Google Gemini)
*   **Business Insights:** Generates actionable reports on sales trends and credit risks.
*   **Support Assistant:** Built-in AI chatbot to answer questions about using the app.
*   **Vision Capabilities:** For reading invoices.

### ☁️ Data Sync
*   **Hybrid Storage:** Works offline using `localStorage` by default.
*   **Cloud Sync:** Optional integration with **Firebase** to sync data across devices in real-time.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript
*   **Styling:** Tailwind CSS
*   **State Management:** React Context API
*   **AI:** Google GenAI SDK (`@google/genai`)
*   **Database:** LocalStorage (Offline) / Firestore (Cloud)
*   **Charts:** Recharts
*   **Utilities:** `qrcode` (for UPI), `firebase` (v10.8)

---

## 💸 Zero Cost Operation ("Free GitHub Mode")

You can run this entire application for **$0/month** using the following stack:

1.  **Hosting:** **GitHub Pages** (Free static hosting).
2.  **Database:** 
    *   **Local Mode:** Uses browser LocalStorage (Free, Private).
    *   **Cloud Mode:** Firebase "Spark" Plan (Free tier includes 1GB storage & 50k reads/day).
3.  **AI Intelligence:** Google Gemini API Free Tier (Rate limited but sufficient for small shops).

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v16 or higher)
*   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/nexus-pos.git
    cd nexus-pos
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory. You need a Google Gemini API key.
    ```env
    # For Vite users:
    VITE_API_KEY=your_google_gemini_api_key_here
    
    # Or if using a different bundler, ensure process.env.API_KEY is populated.
    ```
    > 🔑 **Get an API Key:** Visit [Google AI Studio](https://aistudio.google.com/) to get a free API key.

4.  **Run the application:**
    ```bash
    npm run dev
    ```

---

## 🌍 Deployment to GitHub Pages

Since this is a static app using `HashRouter`, it works perfectly on GitHub Pages.

1.  **Build the Project:**
    ```bash
    npm run build
    ```
    *Ensure your build tool injects the `API_KEY` environment variable during the build process.*

2.  **Deploy:**
    *   Upload the contents of the `dist` or `build` folder to your GitHub repository.
    *   Go to **Settings** > **Pages**.
    *   Select your branch (e.g., `main` or `gh-pages`) and save.

---

## ☁️ Setting up Cloud Sync (Firebase)

The app works 100% locally out of the box. To enable multi-device sync:

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project.
3.  Enable **Authentication** (Google Provider) and **Firestore Database**.
4.  In Project Settings, copy the `firebaseConfig` object (JSON).
5.  **In the Nexus POS App:**
    *   Go to the Login Screen.
    *   Switch to "Cloud Sync".
    *   Paste the JSON configuration into the text area.
    *   Login with Google.

---

## 📖 Usage Guide

1.  **Dashboard:** View daily sales, revenue, and ask AI for business advice.
2.  **Inventory:** 
    *   Add your shop items here first.
    *   Use "Scan Invoice" to bulk add items from a picture.
3.  **Settings:**
    *   Set your **UPI ID** here (required for QR codes).
    *   Configure Taxes (e.g., VAT, GST) to apply them during checkout.
4.  **POS:** 
    *   Select a customer (optional).
    *   Add items to cart.
    *   Checkout -> Select Payment Method.
    *   If "Store Credit" is selected, the amount is added to the customer's debt profile.
5.  **Customers:**
    *   View who owes you money.
    *   Click "Settle Debt" when they pay you back.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
