// js/dashboard.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userName = localStorage.getItem('userName') || user.email;
        document.getElementById('welcomeMessage').textContent = `Welcome, ${userName}`;
    } else {
        window.location.href = 'index.html';
    }
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// --- 2. COMPUTE DASHBOARD ANALYTICS ---
const salesRef = ref(db, 'sales');

onValue(salesRef, (snapshot) => {
    let totalSalesToday = 0;
    let totalSalesMonth = 0;
    let jobsInProgressCount = 0;
    let totalPendingPayments = 0; 
    
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); 

    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();

        // Ensure we default to 0 if amountPaid is somehow empty
        const amountPaid = job.amountPaid || 0; 

        // 1. Count Jobs In Progress
        if (job.status === "In Progress") {
            jobsInProgressCount++;
        }

        // 2. Compute Total Cash Received Today (Fix: Now uses amountPaid instead of total amount)
        if (job.dateReceived === today) {
            totalSalesToday += amountPaid;
        }

        // 3. Compute Total Cash Received This Month (Fix: Now uses amountPaid)
        if (job.dateReceived.startsWith(currentMonth)) {
            totalSalesMonth += amountPaid;
        }
        
        // 4. Compute Total Pending Payments (Balance)
        const balance = job.amount - amountPaid;
        if (balance > 0) {
            totalPendingPayments += balance;
        }
    });

    // Update the HTML cards instantly
    document.getElementById('salesToday').textContent = `₱${totalSalesToday.toLocaleString()}`;
    document.getElementById('salesMonth').textContent = `₱${totalSalesMonth.toLocaleString()}`;
    document.getElementById('jobsInProgress').textContent = jobsInProgressCount;
    document.getElementById('pendingPayments').textContent = `₱${totalPendingPayments.toLocaleString()}`; 
});