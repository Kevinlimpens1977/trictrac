// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD3Fn6ULSVQTdC9twTDwp5xG1dWyKZasLg",
  authDomain: "trictrac-c5890.firebaseapp.com",
  projectId: "trictrac-c5890",
  storageBucket: "trictrac-c5890.firebasestorage.app",
  messagingSenderId: "527441013099",
  appId: "1:527441013099:web:86adc90e0b7113c0d5842e",
  measurementId: "G-E1VCWGLXZ5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);