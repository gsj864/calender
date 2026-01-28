// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA6cJ17ONNniVeARZkdSaKbOnuPyTR1iUA",
  authDomain: "calendar-7ed47.firebaseapp.com",
  projectId: "calendar-7ed47",
  storageBucket: "calendar-7ed47.firebasestorage.app",
  messagingSenderId: "473050962088",
  appId: "1:473050962088:web:8b1c44232c72718f47ca9d",
  measurementId: "G-SHW5R0BMTK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);