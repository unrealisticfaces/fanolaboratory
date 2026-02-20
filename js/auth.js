// js/auth.js

import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Grab values from the form
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // 1. Authenticate the user
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Fetch the user's role from the Realtime Database
            const userRef = ref(db, 'users/' + user.uid);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                // 3. Store basic info in localStorage for easy access on other pages
                localStorage.setItem('userRole', userData.role);
                localStorage.setItem('userName', userData.name);
                localStorage.setItem('userUid', user.uid);

                // 4. Redirect to the dashboard
                window.location.href = 'dashboard.html';
            } else {
                errorMessage.textContent = "Error: User role not found in database. Contact administrator.";
                errorMessage.classList.remove('d-none');
            }
        } catch (error) {
            // Handle incorrect passwords or emails
            errorMessage.textContent = "Login failed: " + error.message;
            errorMessage.classList.remove('d-none');
        }
    });
}