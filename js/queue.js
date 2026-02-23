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
    
    let priorityJobs = [];

    // 1. Setup strict local time for "Today"
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    // 2. Gather and filter jobs
    snapshot.forEach((child) => {
        const job = child.val();
        if (job.status === "In Progress") {
            
            if (job.dueDate && job.dueDate !== "-") {
                // Parse date safely to avoid UTC timezone shifts
                const parts = job.dueDate.split('-');
                const dueObj = new Date(parts[0], parts[1] - 1, parts[2]);
                const diffDays = Math.ceil((dueObj - todayObj) / (1000 * 3600 * 24));
                
                // PRIORITY FILTER: Only show jobs due in 2 days or less (including Overdue)
                if (diffDays <= 2) {
                    job.diffDays = diffDays; // Store for sorting
                    priorityJobs.push(job);
                }
            }
        }
    });

    // 3. Sort the queue based on closest Due Date (Overdue/Today at the top)
    priorityJobs.sort((a, b) => a.diffDays - b.diffDays);

    // 4. Render the filtered cards
    priorityJobs.forEach((job) => {
        let dueBadge = '';
        
        if (job.diffDays < 0) {
            dueBadge = `<span class="badge bg-danger shadow-sm">OVERDUE (${Math.abs(job.diffDays)} Days)</span>`;
        } else if (job.diffDays === 0) {
            dueBadge = `<span class="badge shadow-sm" style="background-color: #dc3545; font-size:0.85rem;">DUE TODAY</span>`;
        } else if (job.diffDays === 1) {
            dueBadge = `<span class="badge bg-warning text-dark shadow-sm">DUE TOMORROW</span>`;
        } else if (job.diffDays === 2) {
            dueBadge = `<span class="badge bg-info text-dark shadow-sm">Due in 2 Days</span>`;
        }

        // Show Remarks box if adjustments are noted
        let remarksHtml = '';
        if (job.remarks && job.remarks.trim() !== "") {
            remarksHtml = `
            <div class="alert alert-danger p-2 mt-3 mb-0 shadow-sm" style="font-size: 0.8rem; border-left: 4px solid #dc3545;">
                <strong>⚠️ Remarks:</strong><br> ${job.remarks}
            </div>`;
        }

        const card = document.createElement('div');
        card.className = 'col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card queue-card p-3 shadow-lg h-100 d-flex flex-column border-0" style="background: rgba(20, 25, 35, 0.95);">
                <div class="d-flex justify-content-between border-bottom border-secondary pb-2 mb-2">
                    ${dueBadge}
                    <small class="text-white-50 text-end">Rec'd: ${job.dateReceived}</small>
                </div>
                <h5 class="mb-1 text-info fw-bold">${job.doctor} ${job.rxNumber && job.rxNumber !== '-' ? `<small class="text-white-50 ms-1">(${job.rxNumber})</small>` : ''}</h5>
                <p class="mb-2 small text-white flex-grow-1">${job.description}</p>
                <div class="mb-3">
                    <span class="badge tech-badge mb-1 shadow-sm">Metal: ${job.techMetal || '-'}</span>
                    <span class="badge tech-badge shadow-sm">Build: ${job.techBuildUp || '-'}</span>
                </div>
                <div class="text-end border-top border-secondary pt-2">
                    <small class="text-secondary">Shade: <strong class="text-white">${job.shade}</strong></small>
                </div>
                ${remarksHtml}
            </div>
        `;
        queueContainer.appendChild(card);
    });

    if (priorityJobs.length === 0) {
        queueContainer.innerHTML = `
            <div class="col-12 text-center mt-5">
                <h3 class="text-success fw-bold">✅ Queue Clear!</h3>
                <p class="text-secondary">No urgent items due in the next 48 hours.</p>
            </div>`;
    }
});