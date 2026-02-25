// js/inprogress.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. AUTH CHECK ---
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
});

const customDateFilter = document.getElementById('customDateFilter');
const searchInput = document.getElementById('searchInput');
const progressTableBody = document.getElementById('progressTableBody');
const progressCountEl = document.getElementById('progressCount');

let inProgressJobs = [];

// --- 2. FETCH ACTIVE JOBS ---
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

// --- 3. RENDER TABLE ---
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
            <td class="fw-bold text-danger-emphasis">${job.dueDate || '-'}</td>
            <td class="text-info-emphasis fw-bold">${job.rxNumber || '-'}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td>${job.description}</td>
            <td>${job.units}</td>
            <td><span class="badge text-bg-secondary">${job.shade}</span></td>
            <td>${job.techMetal || '-'}</td>
            <td>${job.techBuildUp || '-'}</td>
            <td class="small fw-bold text-danger-emphasis" style="max-width: 150px; white-space: normal;">${job.remarks || ''}</td>
            <td>
                <button class="btn btn-sm btn-outline-secondary edit-btn shadow-sm" data-id="${job.id}" title="Edit/Update Job">✏️ Edit</button>
            </td>
        `;
        progressTableBody.appendChild(row);
    });
}

// --- 4. POPULATE EDIT MODAL ---
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

            // Needed to calculate billing data for the Email Receipt
            document.getElementById('editAmount').value = job.amount; 
            document.getElementById('editPaymentStatus').value = job.paymentStatus || "Unpaid"; 
            document.getElementById('editAmountPaid').value = job.amountPaid || 0; 
            document.getElementById('editRemarks').value = job.remarks || "";
            
            // Clear the email field every time the modal opens
            document.getElementById('editDoctorEmail').value = ""; 
            
            editModalInstance = new bootstrap.Modal(document.getElementById('editSaleModal'));
            editModalInstance.show();
        }
    }
});

// --- 5. UPDATE FIREBASE & SEND EMAILJS RECEIPT ---
if (editSaleForm) {
    editSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtn = document.getElementById('saveUpdateBtn');
        saveBtn.innerText = "Saving & Sending..."; // Visual feedback
        saveBtn.disabled = true;

        const jobId = document.getElementById('editJobId').value;
        let updatedDateDeliver = document.getElementById('editDateDeliver').value;
        let derivedStatus = "In Progress";

        // Auto-mark as delivered if a delivery date is provided
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
            // A. UPDATE FIREBASE FIRST
            await update(ref(db, `sales/${jobId}`), updatedData);

            // B. GRAB DATA FOR EMAIL
            const doctorEmail = document.getElementById('editDoctorEmail').value.trim();
            const totalAmount = parseFloat(document.getElementById('editAmount').value) || 0;
            const amountPaid = parseFloat(document.getElementById('editAmountPaid').value) || 0;
            const balance = totalAmount - amountPaid;

            // C. TRIGGER EMAILJS IF APPLICABLE
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

                // 🚨 IMPORTANT: Replace with your actual Service ID and Template ID 🚨
                emailjs.send('service_fkrvq76', 'template_ipgfz9o', templateParams)
                    .then(function(response) {
                       console.log('Email sent successfully!', response.status, response.text);
                       alert("Job marked Delivered and Receipt Email sent to Doctor!");
                    }, function(error) {
                       console.error('Email Failed...', error);
                       alert("Job saved, but the email failed to send. Check console for details.");
                    });
            } else {
               // Normal success message if no email was sent
               alert("Job updated successfully!");
            }

            editModalInstance.hide();
        } catch (error) {
            console.error("Error updating: ", error);
            alert("Failed to update record.");
        } finally {
            // Reset button state
            saveBtn.innerText = "Update Record";
            saveBtn.disabled = false;
        }
    });
}