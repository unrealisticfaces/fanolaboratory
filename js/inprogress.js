// js/inprogress.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, remove, get, push, set, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let currentUserName = 'Unknown User';
let currentUserRole = 'staff'; 

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
    else {
        currentUserName = localStorage.getItem('userName') || user.email;
        currentUserRole = localStorage.getItem('userRole') || 'staff'; 
    }
});

async function createLog(action, details) {
    try {
        const logRef = ref(db, 'audit_logs');
        await set(push(logRef), { timestamp: new Date().toLocaleString(), user: currentUserName, action: action, details: details });
    } catch (error) { console.error("Audit Log Error:", error); }
}

const customDateFilter = document.getElementById('customDateFilter');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect'); // NEW Sort Dropdown
const progressTableBody = document.getElementById('progressTableBody');
const progressCountEl = document.getElementById('progressCount');

let inProgressJobs = [];

const inProgressQuery = query(ref(db, 'sales'), orderByChild('status'), equalTo('In Progress'));

onValue(inProgressQuery, (snapshot) => {
    inProgressJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        job.id = childSnapshot.key; 
        inProgressJobs.push(job);
    });
    applyFilters();
});

if(customDateFilter) customDateFilter.addEventListener('change', applyFilters);
if(searchInput) searchInput.addEventListener('input', applyFilters);
if(sortSelect) sortSelect.addEventListener('change', applyFilters);

function applyFilters() {
    const customDate = customDateFilter.value;
    const searchTerm = searchInput.value.toLowerCase();
    const sortValue = sortSelect ? sortSelect.value : 'received';

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

    // --- NEW SMART SORTING LOGIC ---
    if (sortValue === 'due') {
        filtered.sort((a, b) => {
            // Push jobs with no due dates to the bottom
            if (!a.dueDate || a.dueDate === "-") return 1;
            if (!b.dueDate || b.dueDate === "-") return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    } else {
        // Default: Sort by Date Received (Newest First)
        filtered.sort((a, b) => new Date(b.dateReceived) - new Date(a.dateReceived));
    }

    renderTable(filtered);
}

function renderTable(jobs) {
    progressTableBody.innerHTML = ''; 
    progressCountEl.textContent = jobs.length;

    if (jobs.length === 0) {
        progressTableBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted py-4">No active jobs found.</td></tr>`;
        return;
    }
    
    // Grab today's date for color-coding the due dates
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    jobs.forEach((job) => {
        // --- DUE DATE COLORING (Brought over from old Due Dates page) ---
        let dueDateDisplay = job.dueDate || '-';
        if (job.dueDate && job.dueDate !== "-") {
            const dueObj = new Date(job.dueDate);
            const diffDays = Math.ceil((dueObj - todayObj) / (1000 * 3600 * 24));
            
            if (diffDays < 0) {
                dueDateDisplay = `<span class="badge text-bg-danger px-2 py-1 shadow-sm">${job.dueDate}</span>`; 
            } else if (diffDays === 0) {
                dueDateDisplay = `<span class="text-danger-emphasis fw-bold">${job.dueDate}</span>`; 
            } else if (diffDays === 1) {
                dueDateDisplay = `<span class="text-warning-emphasis fw-bold">${job.dueDate}</span>`; 
            } else {
                dueDateDisplay = `<span class="fw-bold">${job.dueDate}</span>`;
            }
        }

        let actionBtns = `<button class="btn btn-sm btn-outline-secondary edit-btn shadow-sm" data-id="${job.id}" title="Edit/Update Job">Update</button>`;
        if (currentUserRole === 'admin') {
            actionBtns += ` <button class="btn btn-sm btn-outline-danger delete-btn shadow-sm ms-1" data-id="${job.id}" title="Delete Job">🗑️ Delete</button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${job.dateReceived}</td>
            <td>${dueDateDisplay}</td>
            <td class="text-info-emphasis fw-bold">${job.rxNumber || '-'}</td>
            <td class="fw-bold text-wrap" style="min-width: 140px;">${job.doctor}</td>
            <td class="text-wrap" style="min-width: 180px;">${job.description}</td>
            <td>${job.units}</td>
            <td><span class="badge text-bg-secondary">${job.shade}</span></td>
            <td>${job.techMetal || '-'}</td>
            <td>${job.techBuildUp || '-'}</td>
            <td class="small fw-bold text-danger-emphasis" style="max-width: 150px; white-space: normal;">${job.remarks || ''}</td>
            <td class="text-nowrap">${actionBtns}</td>
        `;
        progressTableBody.appendChild(row);
    });
}

const editSaleForm = document.getElementById('editSaleForm');
let editModalInstance;

progressTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const jobId = target.getAttribute('data-id');
    if (!jobId) return;

    if (target.classList.contains('delete-btn')) {
        if (currentUserRole !== 'admin') {
            alert("Only administrators can delete jobs.");
            return;
        }
        if (confirm("⚠️ Are you sure you want to permanently delete this lab job?")) {
            try {
                const snap = await get(ref(db, `sales/${jobId}`));
                const data = snap.val();
                await remove(ref(db, `sales/${jobId}`));
                await createLog("DELETE", `Deleted in-progress job for ${data.doctor} (RX: ${data.rxNumber || '-'})`);
            } catch (error) {
                console.error("Error deleting record: ", error);
                alert("Failed to delete record.");
            }
        }
        return; 
    }

    if (target.classList.contains('edit-btn')) {
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
            document.getElementById('editDoctorEmail').value = ""; 
            
            editModalInstance = new bootstrap.Modal(document.getElementById('editSaleModal'));
            editModalInstance.show();
        }
    }
});

if (editSaleForm) {
    editSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtn = document.getElementById('saveUpdateBtn');
        saveBtn.innerText = "Saving & Sending..."; 
        saveBtn.disabled = true;

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
            description: document.getElementById('editDescription').value,
            techMetal: document.getElementById('editTechMetal').value || "-",
            techBuildUp: document.getElementById('editTechBuildUp').value || "-",
            messengerPickUp: document.getElementById('editMessengerPickUp').value || "-",
            messengerDeliver: document.getElementById('editMessengerDeliver').value || "-",
            dateDeliver: updatedDateDeliver, 
            remarks: document.getElementById('editRemarks').value,
        };

        try {
            await update(ref(db, `sales/${jobId}`), updatedData);

            const doctorEmail = document.getElementById('editDoctorEmail').value.trim();
            const totalAmount = parseFloat(document.getElementById('editAmount').value) || 0;
            const amountPaid = parseFloat(document.getElementById('editAmountPaid').value) || 0;
            const balance = totalAmount - amountPaid;

            if (derivedStatus === "Delivered" && doctorEmail !== "") {
                const templateParams = {
                    to_email: doctorEmail,
                    doctor_name: updatedData.doctor,
                    rx_number: updatedData.rxNumber,
                    description: updatedData.description,
                    date_delivered: updatedData.dateDeliver,
                    total_amount: totalAmount.toLocaleString(),
                    balance: balance.toLocaleString()
                };

                emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams)
                    .then(function() {
                       alert("Job marked Delivered and Receipt Email sent to Doctor!");
                    }, function(error) {
                       console.error('Email Failed...', error);
                       alert("Job saved, but the email failed to send.");
                    });
            } else {
               alert("Job updated successfully!");
            }

            editModalInstance.hide();
        } catch (error) {
            console.error("Error updating: ", error);
            alert("Failed to update record.");
        } finally {
            saveBtn.innerText = "Update Record";
            saveBtn.disabled = false;
        }
    });
}