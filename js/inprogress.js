// js/inprogress.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const progressTableBody = document.getElementById('progressTableBody');
const progressCountEl = document.getElementById('progressCount');

let inProgressJobs = [];

const salesRef = ref(db, 'sales');
onValue(salesRef, (snapshot) => {
    inProgressJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        if (job.status === "In Progress") {
            job.id = childSnapshot.key; 
            inProgressJobs.push(job);
        }
    });
    applyFilters();
});

customDateFilter.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

function applyFilters() {
    const customDate = customDateFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    let filtered = inProgressJobs.filter(job => {
        if (customDate && job.dateReceived !== customDate) return false;

        if (searchTerm) {
            return (
                job.doctor.toLowerCase().includes(searchTerm) || 
                (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) ||
                job.description.toLowerCase().includes(searchTerm)
            );
        }
        return true;
    });

    filtered.sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));
    renderTable(filtered);
}

function renderTable(jobs) {
    progressTableBody.innerHTML = ''; 
    progressCountEl.textContent = jobs.length;

    if (jobs.length === 0) {
        progressTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">No active jobs found.</td></tr>`;
        return;
    }
    
    jobs.forEach((job) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${job.dateReceived}</td>
            <td class="fw-bold text-danger">${job.dueDate || '-'}</td>
            <td class="text-info fw-bold">${job.rxNumber || '-'}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td>${job.description}</td>
            <td>${job.units}</td>
            <td><span class="badge bg-secondary">${job.shade}</span></td>
            <td>${job.techMetal || '-'}</td>
            <td>${job.techBuildUp || '-'}</td>
            <td class="small fw-bold text-danger-emphasis" style="max-width: 150px; white-space: normal;">${job.remarks || ''}</td>
            <td>
                <button class="btn btn-sm btn-light border text-primary edit-btn shadow-sm" data-id="${job.id}" title="Edit/Update Job">✏️ Edit</button>
            </td>
        `;
        progressTableBody.appendChild(row);
    });
}

const editSaleForm = document.getElementById('editSaleForm');
let editModalInstance;

progressTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('edit-btn')) {
        const jobId = target.getAttribute('data-id');
        const job = inProgressJobs.find(j => j.id === jobId);
        if (job) {
            document.getElementById('editJobId').value = jobId;
            document.getElementById('editDateReceived').value = job.dateReceived;
            document.getElementById('editDueDate').value = job.dueDate && job.dueDate !== "-" ? job.dueDate : "";
            document.getElementById('editRxNumber').value = job.rxNumber && job.rxNumber !== "-" ? job.rxNumber : ""; 
            document.getElementById('editDoctor').value = job.doctor;
            document.getElementById('editDescription').value = job.description; 
            document.getElementById('editUnits').value = job.units || 0; 
            document.getElementById('editShade').value = job.shade !== "-" ? job.shade : ""; 
            
            document.getElementById('editTechMetal').value = job.techMetal !== "-" ? job.techMetal : "";
            document.getElementById('editTechBuildUp').value = job.techBuildUp !== "-" ? job.techBuildUp : "";
            document.getElementById('editMessengerPickUp').value = job.messengerPickUp !== "-" ? job.messengerPickUp : "";
            document.getElementById('editMessengerDeliver').value = job.messengerDeliver !== "-" ? job.messengerDeliver : "";
            document.getElementById('editDateDeliver').value = job.dateDeliver !== "-" ? job.dateDeliver : "";

            document.getElementById('editAmount').value = job.amount; 
            document.getElementById('editPaymentStatus').value = job.paymentStatus || "Unpaid"; 
            document.getElementById('editAmountPaid').value = job.amountPaid || 0; 
            document.getElementById('editRemarks').value = job.remarks || "";
            
            editModalInstance = new bootstrap.Modal(document.getElementById('editSaleModal'));
            editModalInstance.show();
        }
    }
});

if (editSaleForm) {
    editSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = document.getElementById('editJobId').value;
        let updatedDateDeliver = document.getElementById('editDateDeliver').value;
        let derivedStatus = "In Progress";

        if (updatedDateDeliver && updatedDateDeliver.trim() !== "") {
            derivedStatus = "Delivered";
        } else {
            updatedDateDeliver = "-";
        }

        const updatedData = {
            status: derivedStatus, 
            dueDate: document.getElementById('editDueDate').value || "-", 
            rxNumber: document.getElementById('editRxNumber').value || "-", 
            doctor: document.getElementById('editDoctor').value,
            techMetal: document.getElementById('editTechMetal').value || "-",
            techBuildUp: document.getElementById('editTechBuildUp').value || "-",
            messengerPickUp: document.getElementById('editMessengerPickUp').value || "-",
            messengerDeliver: document.getElementById('editMessengerDeliver').value || "-",
            dateDeliver: updatedDateDeliver, 
            remarks: document.getElementById('editRemarks').value,
        };

        try {
            await update(ref(db, `sales/${jobId}`), updatedData);
            editModalInstance.hide();
        } catch (error) {
            console.error("Error updating: ", error);
        }
    });
}