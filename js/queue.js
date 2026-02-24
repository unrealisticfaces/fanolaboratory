// js/queue.js

import { db } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const queueContainer = document.getElementById('queueContainer');

// Update Clock Live
setInterval(() => {
    const liveTimer = document.getElementById('liveTimer');
    if (liveTimer) {
        liveTimer.innerText = new Date().toLocaleTimeString();
    }
}, 1000);

const salesRef = ref(db, 'sales');

onValue(salesRef, (snapshot) => {
    if (!queueContainer) return;
    queueContainer.innerHTML = '';
    
    let priorityJobs = [];

    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    snapshot.forEach((child) => {
        const job = child.val();
        if (job.status === "In Progress") {
            if (job.dueDate && job.dueDate !== "-") {
                const parts = job.dueDate.split('-');
                if(parts.length === 3) {
                    const dueObj = new Date(parts[0], parts[1] - 1, parts[2]);
                    const timeDiff = dueObj.getTime() - todayObj.getTime();
                    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    
                    if (diffDays <= 2) {
                        job.diffDays = diffDays; 
                        priorityJobs.push(job);
                    }
                }
            }
        }
    });

    priorityJobs.sort((a, b) => a.diffDays - b.diffDays);

    priorityJobs.forEach((job) => {
        let dueBadge = '';
        
        if (job.diffDays < 0) {
            dueBadge = `<span class="badge bg-danger shadow-sm">OVERDUE (${Math.abs(job.diffDays)} Days)</span>`;
        } else if (job.diffDays === 0) {
            dueBadge = `<span class="badge shadow-sm" style="background-color: #dc3545; font-size:0.85rem;">🔥 DUE TODAY</span>`;
        } else if (job.diffDays === 1) {
            dueBadge = `<span class="badge bg-warning text-dark shadow-sm">DUE TOMORROW</span>`;
        } else if (job.diffDays === 2) {
            dueBadge = `<span class="badge bg-info text-dark shadow-sm">Due in 2 Days</span>`;
        }

        // FIXED RED TEXT: Softer custom alert style that doesn't burn the eyes in dark mode!
        let remarksHtml = '';
        if (job.remarks && job.remarks.trim() !== "") {
            remarksHtml = `
            <div class="p-2 mt-3 mb-0 rounded shadow-sm" style="background-color: rgba(255, 107, 107, 0.1); border-left: 4px solid #ff6b6b;">
                <strong style="color: #ff6b6b; font-size: 0.8rem;">⚠️ Remarks:</strong><br> 
                <span style="color: #e2e8f0; font-size: 0.85rem;">${job.remarks}</span>
            </div>`;
        }

        const card = document.createElement('div');
        card.className = 'col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card queue-card p-3 shadow-lg h-100 d-flex flex-column border-0" style="background: rgba(15, 23, 42, 0.95);">
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