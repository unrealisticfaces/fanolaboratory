// js/delivered.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
});

const customDateFilter = document.getElementById('customDateFilter');
const searchInput = document.getElementById('searchInput');
const deliveredTableBody = document.getElementById('deliveredTableBody');
const deliveredCountEl = document.getElementById('deliveredCount');

let deliveredJobs = [];

// OPTIMIZATION: Only fetch jobs that are "Delivered"
const deliveredQuery = query(ref(db, 'sales'), orderByChild('status'), equalTo('Delivered'));

onValue(deliveredQuery, (snapshot) => {
    deliveredJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        job.id = childSnapshot.key; 
        deliveredJobs.push(job);
    });
    applyFilters();
});

customDateFilter.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

function applyFilters() {
    const customDate = customDateFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    let filtered = deliveredJobs.filter(job => {
        if (customDate && job.dateDeliver !== customDate) return false;

        if (searchTerm) {
            return (
                job.doctor.toLowerCase().includes(searchTerm) || 
                (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) ||
                job.description.toLowerCase().includes(searchTerm) ||
                (job.messengerDeliver && job.messengerDeliver.toLowerCase().includes(searchTerm))
            );
        }
        return true;
    });

    filtered.sort((a, b) => new Date(b.dateDeliver) - new Date(a.dateDeliver));
    renderTable(filtered);
}

function renderTable(jobs) {
    deliveredTableBody.innerHTML = ''; 
    deliveredCountEl.textContent = jobs.length;

    if (jobs.length === 0) {
        deliveredTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No delivered items found.</td></tr>`;
        return;
    }
    
    jobs.forEach((job) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold text-success-emphasis">${job.dateDeliver}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td class="text-info-emphasis fw-bold">${job.rxNumber || '-'}</td>
            <td>${job.description}</td>
            <td>${job.units}</td>
            <td>${job.messengerDeliver || '-'}</td>
            <td class="fw-bold text-body-emphasis">₱${(job.amountPaid || 0).toLocaleString()}</td>
        `;
        deliveredTableBody.appendChild(row);
    });
}