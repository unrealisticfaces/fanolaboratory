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
    let count = 0;

    snapshot.forEach((child) => {
        const job = child.val();

        // ONLY SHOW JOBS THAT ARE "In Progress"
        if (job.status === "In Progress") {
            count++;
            const card = document.createElement('div');
            card.className = 'col-md-4 col-lg-3';
            card.innerHTML = `
                <div class="card queue-card p-3 shadow-lg">
                    <div class="d-flex justify-content-between border-bottom border-secondary pb-2 mb-2">
                        <small class="text-secondary">${job.dateReceived}</small>
                        <span class="badge bg-warning text-dark">IN QUEUE</span>
                    </div>
                    <h5 class="mb-1 text-info">${job.doctor}</h5>
                    <p class="mb-2 small text-white-50">${job.description}</p>
                    <div class="mb-3">
                        <span class="badge tech-badge">Metal: ${job.techMetal || '-'}</span>
                        <span class="badge tech-badge">Build: ${job.techBuildUp || '-'}</span>
                    </div>
                    <div class="text-end">
                        <small class="text-secondary">Shade: <strong>${job.shade}</strong></small>
                    </div>
                </div>
            `;
            queueContainer.appendChild(card);
        }
    });

    if (count === 0) {
        queueContainer.innerHTML = '<div class="col-12 text-center mt-5"><h4 class="text-secondary">Production clear. No jobs in progress!</h4></div>';
    }
});