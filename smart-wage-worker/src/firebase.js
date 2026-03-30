import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDgFhZ6K322MmtQRSzVQw5Ds8WdNA7xX94",
  authDomain: "smart-wage.firebaseapp.com",
  projectId: "smart-wage",
  storageBucket: "smart-wage.firebasestorage.app",
  messagingSenderId: "1091369718378",
  appId: "1:1091369718378:web:2c1fb23d1cef0ec1033013",
  measurementId: "G-2XMV8YW594"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { app, db, auth, storage, analytics };
