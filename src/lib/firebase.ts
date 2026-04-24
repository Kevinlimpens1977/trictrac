import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD3Fn6ULSVQTdC9twTDwp5xG1dWyKZasLg",
  authDomain: "trictrac-c5890.firebaseapp.com",
  projectId: "trictrac-c5890",
  storageBucket: "trictrac-c5890.firebasestorage.app",
  messagingSenderId: "527441013099",
  appId: "1:527441013099:web:86adc90e0b7113c0d5842e",
  measurementId: "G-E1VCWGLXZ5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
