// js/firebase-config.js

// Import the functions using direct CDN links for Vanilla JS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8_dUZlOZAZmgK4geTOTLUxe-8wK1DXn4",
  authDomain: "dentallab-erp.firebaseapp.com",
  databaseURL: "https://dentallab-erp-default-rtdb.asia-southeast1.firebasedatabase.app", // Check your Firebase console to ensure this URL matches your chosen region
  projectId: "dentallab-erp",
  storageBucket: "dentallab-erp.firebasestorage.app",
  messagingSenderId: "448951048689",
  appId: "1:448951048689:web:319be6fe775e2796c00c50"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication and Realtime Database, then export them
export const auth = getAuth(app);
export const db = getDatabase(app);