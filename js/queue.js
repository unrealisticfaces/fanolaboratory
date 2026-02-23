// js/queue.js
import { db } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const queueContainer = document.getElementById('queueContainer');

// Update Clock
setInterval(() => {
    document.getElementById('liveTimer').innerText = new Date().toLocaleTimeString();
}, 1000);

const salesRef = ref(db, 'sales');

onValue(salesRef, (snapshot) => {
    queueContainer.innerHTML = '';
    
    let inProgressJobs = [];

    // Gather only active jobs
    snapshot.forEach((child) => {
        const job = child.val();
        if (job.status === "In Progress") {
            inProgressJobs.push(job);
        }
    });

    // SMART LOGIC: Sort the queue based on Due Date (Closest dates at the top)
    inProgressJobs.sort((a, b) => {
        if (!a.dueDate || a.dueDate === "-") return 1;  // Push to bottom if no due date
        if (!b.dueDate || b.dueDate === "-") return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const todayObj = new Date();
    todayObj.setHours(0,0,0,0);

    inProgressJobs.forEach((job) => {
        // Calculate urgency badge
        let dueBadge = `<span class="badge bg-secondary text-white">No Due Date</span>`;
        if (job.dueDate && job.dueDate !== "-") {
            const dueObj = new Date(job.dueDate);
            const diffDays = Math.ceil((dueObj - todayObj) / (1000 * 3600 * 24));
            
            if (diffDays < 0) {
                dueBadge = `<span class="badge bg-danger">OVERDUE!</span>`;
            } else if (diffDays === 0) {
                dueBadge = `<span class="badge bg-danger">DUE TODAY</span>`;
            } else if (diffDays === 1) {
                dueBadge = `<span class="badge bg-warning text-dark">DUE TOMORROW</span>`;
            } else {
                dueBadge = `<span class="badge bg-info text-dark">Due in ${diffDays} Days</span>`;
            }
        }

        // Show Remarks box if adjustments are noted
        let remarksHtml = '';
        if (job.remarks && job.remarks.trim() !== "") {
            remarksHtml = `
            <div class="alert alert-danger p-2 mt-3 mb-0" style="font-size: 0.8rem; border-left: 4px solid #dc3545;">
                <strong>⚠️ Remarks:</strong><br> ${job.remarks}
            </div>`;
        }

        const card = document.createElement('div');
        card.className = 'col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card queue-card p-3 shadow-lg h-100 d-flex flex-column">
                <div class="d-flex justify-content-between border-bottom border-secondary pb-2 mb-2">
                    ${dueBadge}
                    <small class="text-white-50 text-end">Rec'd: ${job.dateReceived}</small>
                </div>
                <h5 class="mb-1 text-info fw-bold">${job.doctor} ${job.rxNumber && job.rxNumber !== '-' ? `<small class="text-white-50 ms-1">(${job.rxNumber})</small>` : ''}</h5>
                <p class="mb-2 small text-white flex-grow-1">${job.description}</p>
                <div class="mb-3">
                    <span class="badge tech-badge mb-1">Metal: ${job.techMetal || '-'}</span>
                    <span class="badge tech-badge">Build: ${job.techBuildUp || '-'}</span>
                </div>
                <div class="text-end border-top border-secondary pt-2">
                    <small class="text-secondary">Shade: <strong class="text-white">${job.shade}</strong></small>
                </div>
                ${remarksHtml}
            </div>
        `;
        queueContainer.appendChild(card);
    });

    if (inProgressJobs.length === 0) {
        queueContainer.innerHTML = '<div class="col-12 text-center mt-5"><h4 class="text-secondary">Production clear. No jobs in progress!</h4></div>';
    }
});