// js/sales.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, push, set, onValue, remove, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. AUTHENTICATION & ROLE CHECK ---
let currentUserRole = 'staff'; // Default to staff just to be safe

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; 
    } else {
        // Grab the role we saved during login
        currentUserRole = localStorage.getItem('userRole') || 'staff';
    }
});

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// --- 2. CREATE: SAVE NEW LAB JOB ---
const addSaleForm = document.getElementById('addSaleForm');

if (addSaleForm) {
    addSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const newJobData = {
            dateReceived: document.getElementById('dateReceived').value,
            doctor: document.getElementById('doctor').value,
            technician: document.getElementById('technician').value,
            description: document.getElementById('description').value,
            units: parseInt(document.getElementById('units').value),
            shade: document.getElementById('shade').value,
            amount: parseFloat(document.getElementById('amount').value),
            paymentStatus: document.getElementById('paymentStatus').value,
            amountPaid: parseFloat(document.getElementById('amountPaid').value) || 0,
            status: "In Progress", 
            timestamp: Date.now(),
            createdBy: auth.currentUser ? auth.currentUser.uid : "unknown"
        };

        try {
            const salesRef = ref(db, 'sales');
            const newSaleRef = push(salesRef);
            await set(newSaleRef, newJobData);

            addSaleForm.reset();
            document.getElementById('amountPaid').value = 0; 
            const modalElement = document.getElementById('addSaleModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance.hide();
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to save record.");
        }
    });
}

// --- 3. READ & FILTER: DISPLAY JOBS IN REAL-TIME ---
const salesTableBody = document.getElementById('salesTableBody');
let allJobs = []; 
let currentFilteredJobs = []; 

function renderTable(jobsToRender) {
    salesTableBody.innerHTML = ''; 
    
    jobsToRender.forEach((job) => {
        const amountPaid = job.amountPaid || 0;
        const balance = job.amount - amountPaid;
        
        let paymentBadge = 'bg-danger'; 
        if (job.paymentStatus === 'Paid') paymentBadge = 'bg-success';
        if (job.paymentStatus === 'Downpayment') paymentBadge = 'bg-info text-dark';

        // CONDITIONAL RENDERING: Only build the Delete button if the user is an Admin
        let actionButtons = `
            <button class="btn btn-sm btn-secondary print-btn mb-1" data-id="${job.id}">Print</button>
            <button class="btn btn-sm btn-primary edit-btn mb-1" data-id="${job.id}">Edit</button>
        `;
        
        if (currentUserRole === 'admin') {
            actionButtons += `<button class="btn btn-sm btn-danger delete-btn mb-1" data-id="${job.id}">Del</button>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${job.dateReceived}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td>${job.description}</td>
            <td><span class="badge bg-secondary">${job.shade}</span></td>
            <td>₱${job.amount.toLocaleString()}</td>
            <td><span class="badge ${paymentBadge}">${job.paymentStatus || 'Unpaid'}</span></td>
            <td class="text-danger fw-bold">₱${balance.toLocaleString()}</td>
            <td><span class="badge bg-warning text-dark">${job.status}</span></td>
            <td>
                ${actionButtons}
            </td>
        `;
        salesTableBody.appendChild(row);
    });
}

const salesRef = ref(db, 'sales');
onValue(salesRef, (snapshot) => {
    allJobs = []; 
    snapshot.forEach((childSnapshot) => {
        const jobData = childSnapshot.val();
        jobData.id = childSnapshot.key; 
        allJobs.push(jobData);
    });
    applyFilters();
});

// FILTER LOGIC
const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const filterPayment = document.getElementById('filterPayment');

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusTerm = filterStatus.value;
    const paymentTerm = filterPayment.value;

    currentFilteredJobs = allJobs.filter(job => {
        const matchesSearch = job.doctor.toLowerCase().includes(searchTerm) || 
                              job.description.toLowerCase().includes(searchTerm) ||
                              job.shade.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusTerm === "All" || job.status === statusTerm;
        const jobPaymentStatus = job.paymentStatus || 'Unpaid';
        const matchesPayment = paymentTerm === "All" || jobPaymentStatus === paymentTerm;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    renderTable(currentFilteredJobs);
}

searchInput.addEventListener('input', applyFilters);
filterStatus.addEventListener('change', applyFilters);
filterPayment.addEventListener('change', applyFilters);

// --- 4. EXPORT TO EXCEL (CSV) ---
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (currentFilteredJobs.length === 0) {
            alert("No data available to export.");
            return;
        }

        let csvContent = "Date Received,Doctor,Technician,Description,Units,Shade,Total Amount,Payment Status,Amount Paid,Balance,Job Status\n";

        currentFilteredJobs.forEach(job => {
            const amtPaid = job.amountPaid || 0;
            const balance = job.amount - amtPaid;
            
            const row = [
                job.dateReceived,
                `"${job.doctor}"`,
                `"${job.technician}"`,
                `"${job.description}"`,
                job.units,
                `"${job.shade}"`,
                job.amount,
                job.paymentStatus || 'Unpaid',
                amtPaid,
                balance,
                job.status
            ].join(",");
            
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `DentalLab_Sales_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// --- 5. ACTION HANDLERS: DELETE, EDIT, & PRINT PDF ---
const editSaleForm = document.getElementById('editSaleForm');
let editModalInstance;

salesTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const jobId = target.getAttribute('data-id');
    if (!jobId) return;

    if (target.classList.contains('delete-btn')) {
        // Extra safety check in case someone tries to force a click via dev tools
        if (currentUserRole !== 'admin') {
            alert("You do not have permission to delete records.");
            return;
        }

        if (confirm("Are you sure you want to delete this lab job?")) {
            try {
                await remove(ref(db, `sales/${jobId}`));
            } catch (error) {
                console.error("Error deleting record: ", error);
            }
        }
    }

    if (target.classList.contains('edit-btn')) {
        try {
            const snapshot = await get(ref(db, `sales/${jobId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                document.getElementById('editJobId').value = jobId;
                document.getElementById('editStatus').value = data.status || "In Progress";
                document.getElementById('editDoctor').value = data.doctor;
                document.getElementById('editTechnician').value = data.technician;
                document.getElementById('editDescription').value = data.description;
                document.getElementById('editUnits').value = data.units;
                document.getElementById('editShade').value = data.shade;
                document.getElementById('editAmount').value = data.amount;
                document.getElementById('editPaymentStatus').value = data.paymentStatus || "Unpaid";
                document.getElementById('editAmountPaid').value = data.amountPaid || 0;
                
                const modalElement = document.getElementById('editSaleModal');
                editModalInstance = new bootstrap.Modal(modalElement);
                editModalInstance.show();
            }
        } catch (error) {
            console.error("Error fetching record: ", error);
        }
    }

    if (target.classList.contains('print-btn')) {
        try {
            const snapshot = await get(ref(db, `sales/${jobId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: "portrait",
                    unit: "in",
                    format: [4.25, 5.5]
                });

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("DENTAL LAB SYSTEM", 2.125, 0.5, { align: "center" }); 
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Date: ${data.dateReceived}`, 0.5, 0.9);
                doc.text(`Doctor: ${data.doctor}`, 0.5, 1.1);
                doc.text(`Technician: ${data.technician}`, 0.5, 1.3);
                
                doc.line(0.5, 1.4, 3.75, 1.4); 
                
                doc.setFont("helvetica", "bold");
                doc.text("JOB DETAILS", 0.5, 1.6);
                doc.setFont("helvetica", "normal");
                doc.text(`Description: ${data.description}`, 0.5, 1.8);
                doc.text(`Units: ${data.units}`, 0.5, 2.0);
                doc.text(`Shade: ${data.shade}`, 0.5, 2.2);
                doc.text(`Status: ${data.status}`, 0.5, 2.4);

                doc.line(0.5, 2.5, 3.75, 2.5); 

                doc.setFont("helvetica", "bold");
                doc.text("BILLING INFO", 0.5, 2.7);
                doc.setFont("helvetica", "normal");
                const amtPaid = data.amountPaid || 0;
                const balance = data.amount - amtPaid;
                doc.text(`Total Amount: Php ${data.amount.toLocaleString()}`, 0.5, 2.9);
                doc.text(`Amount Paid: Php ${amtPaid.toLocaleString()}`, 0.5, 3.1);
                doc.text(`Balance: Php ${balance.toLocaleString()}`, 0.5, 3.3);
                doc.text(`Payment Status: ${data.paymentStatus || 'Unpaid'}`, 0.5, 3.5);

                doc.setFont("helvetica", "italic");
                doc.text("Thank you for your business!", 2.125, 4.5, { align: "center" });

                doc.save(`Receipt_${data.doctor.replace(/\s+/g, '_')}.pdf`);
            }
        } catch (error) {
            console.error("Error generating PDF: ", error);
            alert("Failed to generate receipt.");
        }
    }
});

if (editSaleForm) {
    editSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const jobId = document.getElementById('editJobId').value;
        const updatedData = {
            status: document.getElementById('editStatus').value,
            doctor: document.getElementById('editDoctor').value,
            technician: document.getElementById('editTechnician').value,
            description: document.getElementById('editDescription').value,
            units: parseInt(document.getElementById('editUnits').value),
            shade: document.getElementById('editShade').value,
            amount: parseFloat(document.getElementById('editAmount').value),
            paymentStatus: document.getElementById('editPaymentStatus').value,
            amountPaid: parseFloat(document.getElementById('editAmountPaid').value) || 0,
        };

        try {
            await update(ref(db, `sales/${jobId}`), updatedData);
            editModalInstance.hide();
        } catch (error) {
            console.error("Error updating record: ", error);
            alert("Failed to update record.");
        }
    });
}