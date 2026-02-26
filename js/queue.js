// js/queue.js

import { db } from './firebase-config.js';
import { ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const queueContainer = document.getElementById('queueContainer');

setInterval(() => {
    const liveTimer = document.getElementById('liveTimer');
    if(liveTimer) liveTimer.innerText = new Date().toLocaleTimeString();
}, 1000);

// OPTIMIZATION: Only fetch jobs that are "In Progress"
const queueQuery = query(ref(db, 'sales'), orderByChild('status'), equalTo('In Progress'));

onValue(queueQuery, (snapshot) => {
    if(!queueContainer) return;
    queueContainer.innerHTML = '';
    
    let priorityJobs = [];

    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    snapshot.forEach((child) => {
        const job = child.val();
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
    });

    priorityJobs.sort((a, b) => a.diffDays - b.diffDays);

    priorityJobs.forEach((job) => {
        let dueBadge = '';
        
        if (job.diffDays < 0) {
            dueBadge = `<span class="badge text-bg-danger shadow-sm">OVERDUE (${Math.abs(job.diffDays)} Days)</span>`;
        } else if (job.diffDays === 0) {
            dueBadge = `<span class="badge shadow-sm" style="background-color: #dc3545; color: white; font-size:0.85rem;">🔥 DUE TODAY</span>`;
        } else if (job.diffDays === 1) {
            dueBadge = `<span class="badge text-bg-warning shadow-sm">DUE TOMORROW</span>`;
        } else if (job.diffDays === 2) {
            dueBadge = `<span class="badge text-bg-info shadow-sm">Due in 2 Days</span>`;
        }

        let remarksHtml = '';
        if (job.remarks && job.remarks.trim() !== "") {
            remarksHtml = `
            <div class="alert alert-danger p-2 mt-3 mb-0 shadow-sm border-0" style="font-size: 0.8rem; border-left: 4px solid #dc3545 !important;">
                <strong>⚠️ Remarks:</strong><br> ${job.remarks}
            </div>`;
        }

        const card = document.createElement('div');
        card.className = 'col-md-4 col-lg-3';
        card.innerHTML = `
            <div class="card p-3 shadow-sm h-100 d-flex flex-column border-secondary-subtle bg-body-tertiary">
                <div class="d-flex justify-content-between border-bottom border-secondary-subtle pb-2 mb-2">
                    ${dueBadge}
                    <small class="text-body-secondary text-end">Rec'd: ${job.dateReceived}</small>
                </div>
                <h5 class="mb-1 text-info-emphasis fw-bold">${job.doctor} ${job.rxNumber && job.rxNumber !== '-' ? `<small class="text-body-secondary ms-1">(${job.rxNumber})</small>` : ''}</h5>
                <p class="mb-2 small flex-grow-1">${job.description}</p>
                <div class="mb-3">
                    <span class="badge text-bg-info mb-1 shadow-sm">Metal: ${job.techMetal || '-'}</span>
                    <span class="badge text-bg-info shadow-sm">Build: ${job.techBuildUp || '-'}</span>
                </div>
                <div class="text-end border-top border-secondary-subtle pt-2">
                    <small class="text-body-secondary">Shade: <strong>${job.shade}</strong></small>
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
                <p class="text-body-secondary">No urgent items due in the next 48 hours.</p>
            </div>`;
    }
});