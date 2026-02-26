// js/duedate.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
});

const customDateFilter = document.getElementById('customDateFilter');
const searchInput = document.getElementById('searchInput');
const dueTableBody = document.getElementById('dueTableBody');
const dueCountEl = document.getElementById('dueCount');

let activeJobs = [];

// OPTIMIZATION: Only fetch jobs that are "In Progress" to check their due dates
const dueQuery = query(ref(db, 'sales'), orderByChild('status'), equalTo('In Progress'));

onValue(dueQuery, (snapshot) => {
    activeJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        if (job.dueDate && job.dueDate !== "-") {
            job.id = childSnapshot.key; 
            activeJobs.push(job);
        }
    });
    applyFilters();
});

customDateFilter.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

function applyFilters() {
    const customDate = customDateFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    let filtered = activeJobs.filter(job => {
        if (customDate && job.dueDate !== customDate) return false;

        if (searchTerm) {
            return (
                job.doctor.toLowerCase().includes(searchTerm) || 
                (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) ||
                job.description.toLowerCase().includes(searchTerm)
            );
        }
        return true;
    });

    filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    renderTable(filtered);
}

function renderTable(jobs) {
    dueTableBody.innerHTML = ''; 
    dueCountEl.textContent = jobs.length;

    if (jobs.length === 0) {
        dueTableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No due dates found.</td></tr>`;
        return;
    }
    
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    jobs.forEach((job) => {
        let dateColorClass = "text-body";
        
        const dueObj = new Date(job.dueDate);
        const diffDays = Math.ceil((dueObj - todayObj) / (1000 * 3600 * 24));

        if (diffDays < 0) {
            dateColorClass = "badge text-bg-danger px-2 py-1 shadow-sm"; 
        } else if (diffDays === 0) {
            dateColorClass = "text-danger-emphasis fw-bold"; 
        } else if (diffDays === 1) {
            dateColorClass = "text-warning-emphasis fw-bold"; 
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold"><span class="${dateColorClass}">${job.dueDate}</span></td>
            <td>${job.dateReceived}</td>
            <td class="text-info-emphasis fw-bold">${job.rxNumber || '-'}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td>${job.description}</td>
            <td>${job.units}</td>
            <td><span class="badge text-bg-secondary">${job.shade}</span></td>
            <td>${job.techMetal || '-'}</td>
            <td>${job.techBuildUp || '-'}</td>
        `;
        dueTableBody.appendChild(row);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam) {
        searchInput.value = searchParam;
    }
});