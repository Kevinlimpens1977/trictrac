import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Auth via het EIGEN domein (first-party): Safari/iOS blokkeert de
// terugweg vanaf firebaseapp.com (ITP). Vercel proxiet /__/auth/* naar
// de Firebase-handler (zie vercel.json). Op localhost gebruiken we het
// standaard Firebase-domein zodat lokaal ontwikkelen blijft werken.
const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const firebaseConfig = {
  apiKey: "AIzaSyD3Fn6ULSVQTdC9twTDwp5xG1dWyKZasLg",
  authDomain: isLocalhost ? "trictrac-c5890.firebaseapp.com" : window.location.hostname,
  projectId: "trictrac-c5890",
  storageBucket: "trictrac-c5890.firebasestorage.app",
  messagingSenderId: "527441013099",
  appId: "1:527441013099:web:86adc90e0b7113c0d5842e",
  measurementId: "G-E1VCWGLXZ5"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
