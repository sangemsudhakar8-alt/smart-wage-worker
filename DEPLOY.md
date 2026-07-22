# 🚀 Deployment Guide: Smart Wage Worker

This guide provides the final steps to deploy your polished and built application to a live production environment.

---

## **Option 1: Firebase Hosting (Recommended)**
Firebase is already configured for this project to host your frontend and your Firestore/Storage rules.

### **Pre-requisites**
- Ensure you have the Firebase CLI installed: `npm install -g firebase-tools`
- The project is already built (verified in `dist/`).

### **Deployment Steps**
1.  **Login**: Open your terminal and run:
    ```powershell
    firebase login
    ```
2.  **Select Project**: Ensure you are using the correct project:
    ```powershell
    firebase use smart-wage
    ```
3.  **Deploy Everything**: Run the following to deploy your Hosting, Firestore Rules, Indices, and Storage Rules:
    ```powershell
    firebase deploy
    ```
    *This will provide you with a live hosting URL (e.g., `https://smart-wage.web.app`).*

---

## **Option 2: Vercel (Alternative)**
If you prefer Vercel for the frontend, follow these steps:

### **Deployment Steps**
1.  **Install CLI**: `npm install -g vercel`
2.  **Deploy**: Run the following command in the root directory:
    ```powershell
    vercel --prod
    ```
    *Note: You will still need to deploy your Firestore/Storage rules via the Firebase CLI using `firebase deploy --only firestore,storage` to ensure security.*

---

## **Post-Deployment Verification**
Once deployed, verify the following on your live URL:
- [ ] **Login**: Test with `1234567890` and OTP `123456`.
- [ ] **Images**: Ensure profile images can be uploaded and viewed.
- [ ] **Voice**: Verify that the voice assistant (English/Telugu/Hindi) is active.
- [ ] **PWA**: Check if the "Install App" prompt appears on mobile devices.

> [!TIP]
> **Firestore Rules**: I have finalized your production rules in `firestore.rules` and `firestore.indexes.json`. The `firebase deploy` command is essential to ensure your database is protected and optimized.
