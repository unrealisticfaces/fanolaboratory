// js/delivered.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

const customDateFilter = document.getElementById('customDateFilter');
const searchInput = document.getElementById('searchInput');
const deliveredTableBody = document.getElementById('deliveredTableBody');
const deliveredCountEl = document.getElementById('deliveredCount');

let allDeliveredJobs = [];

// SMART FIX: Set Date Picker to Exact Local Date on Load
const d = new Date();
const localYear = d.getFullYear();
const localMonth = String(d.getMonth() + 1).padStart(2, '0');
const localDay = String(d.getDate()).padStart(2, '0');
customDateFilter.value = `${localYear}-${localMonth}-${localDay}`; // e.g. 2024-05-18

const salesRef = ref(db, 'sales');
onValue(salesRef, (snapshot) => {
    allDeliveredJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        if (job.status === "Delivered") {
            job.id = childSnapshot.key; 
            allDeliveredJobs.push(job);
        }
    });
    applyFilters();
});

customDateFilter.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

function applyFilters() {
    const customDate = customDateFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    // STRICT MATCH: Only show jobs delivered on the selected date
    let filtered = allDeliveredJobs.filter(job => {
        if (!job.dateDeliver || job.dateDeliver === "-") return false;
        return job.dateDeliver === customDate;
    });

    // Handle Search Bar Filtering
    if (searchTerm) {
        filtered = filtered.filter(job => {
            return (
                job.doctor.toLowerCase().includes(searchTerm) || 
                (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) ||
                job.description.toLowerCase().includes(searchTerm) ||
                (job.messengerDeliver && job.messengerDeliver.toLowerCase().includes(searchTerm))
            );
        });
    }

    filtered.sort((a, b) => new Date(b.dateDeliver) - new Date(a.dateDeliver));
    renderTable(filtered);
}

function renderTable(jobs) {
    deliveredTableBody.innerHTML = ''; 
    let totalItems = 0;

    if (jobs.length === 0) {
        deliveredTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No items were delivered on this date.</td></tr>`;
        deliveredCountEl.textContent = 0;
        return;
    }
    
    jobs.forEach((job) => {
        totalItems++; 
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold text-success">${job.dateDeliver}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td class="text-info fw-bold">${job.rxNumber || '-'}</td>
            <td>${job.description}</td>
            <td>${job.units}</td>
            <td class="fw-bold text-secondary">${job.messengerDeliver || 'Unassigned'}</td>
            <td class="fw-bold text-dark">₱${(job.amountPaid || 0).toLocaleString()}</td>
        `;
        deliveredTableBody.appendChild(row);
    });
    
    deliveredCountEl.textContent = totalItems;
}