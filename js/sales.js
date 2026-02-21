// js/sales.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, push, set, onValue, remove, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. AUTHENTICATION & ROLE CHECK ---
let currentUserRole = 'staff'; 
let currentUserName = 'Unknown User';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; 
    } else {
        currentUserRole = localStorage.getItem('userRole') || 'staff';
        // Retrieve the name to use in Audit Logs
        currentUserName = localStorage.getItem('userName') || user.email;
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

// --- NEW HELPER: CREATE AUDIT LOG ---
async function createLog(action, details) {
    try {
        const logRef = ref(db, 'audit_logs');
        const newLogRef = push(logRef);
        await set(newLogRef, {
            timestamp: new Date().toLocaleString(),
            user: currentUserName,
            action: action,
            details: details
        });
    } catch (error) {
        console.error("Audit Log Error:", error);
    }
}

// --- 2. CREATE: SAVE NEW LAB JOB ---
const addSaleForm = document.getElementById('addSaleForm');

if (addSaleForm) {
    addSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const newJobData = {
            dateReceived: document.getElementById('dateReceived').value,
            doctor: document.getElementById('doctor').value,
            description: document.getElementById('description').value,
            units: parseInt(document.getElementById('units').value) || 0,
            shade: document.getElementById('shade').value || "-",
            techMetal: document.getElementById('techMetal').value || "-",
            techBuildUp: document.getElementById('techBuildUp').value || "-",
            messengerPickUp: document.getElementById('messengerPickUp').value || "-",
            messengerDeliver: document.getElementById('messengerDeliver').value || "-",
            dateDeliver: document.getElementById('dateDeliver').value || "-",
            amount: parseFloat(document.getElementById('amount').value) || 0,
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

            // LOG THE ADDITION
            await createLog("CREATE", `Added job for ${newJobData.doctor}: ${newJobData.description}`);

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
        
        // --- 1. BALANCE COLOR LOGIC ---
        let paymentBadge = 'bg-danger';      
        let balanceTextClass = 'text-danger'; 

        if (job.paymentStatus === 'Paid') {
            paymentBadge = 'bg-success';      
            balanceTextClass = 'text-success'; 
        } else if (job.paymentStatus === 'Downpayment') {
            paymentBadge = 'bg-info text-dark'; 
            balanceTextClass = 'text-danger';     
        }

        // --- 2. JOB STATUS COLOR LOGIC (THE FIX) ---
        let statusBadgeClass = 'bg-warning text-dark'; // Default: In Progress (Yellow)

        if (job.status === 'Completed') {
            statusBadgeClass = 'bg-success';           // Completed (Blue)
        } else if (job.status === 'Delivered') {
            statusBadgeClass = 'bg-success';           // Delivered (Green)
        }

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
            <td>${job.units}</td>
            <td><span class="badge bg-secondary">${job.shade}</span></td>
            <td>${job.techMetal || '-'}</td>
            <td>${job.techBuildUp || '-'}</td>
            <td>${job.messengerPickUp || '-'}</td>
            <td>${job.messengerDeliver || '-'}</td>
            <td>${job.dateDeliver !== '-' ? job.dateDeliver : '<small class="text-muted">Pending</small>'}</td>
            <td>₱${job.amount.toLocaleString()}</td>
            <td><span class="badge ${paymentBadge}">${job.paymentStatus || 'Unpaid'}</span></td>
            <td class="${balanceTextClass} fw-bold">₱${balance.toLocaleString()}</td>
            <td><span class="badge ${statusBadgeClass}">${job.status}</span></td>
            <td>${actionButtons}</td>
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
        const matchesSearch = 
            job.doctor.toLowerCase().includes(searchTerm) || 
            job.description.toLowerCase().includes(searchTerm) ||
            (job.shade && job.shade.toLowerCase().includes(searchTerm)) ||
            (job.techMetal && job.techMetal.toLowerCase().includes(searchTerm)) ||
            (job.techBuildUp && job.techBuildUp.toLowerCase().includes(searchTerm));
        
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

        let csvContent = "Date Received,Doctor,Description,Units,Shade,Technician (Metal),Technician (Build Up),Messenger (Pick Up),Messenger (Deliver),Date Delivered,Total Amount,Payment Status,Amount Paid,Balance,Job Status\n";

        currentFilteredJobs.forEach(job => {
            const amtPaid = job.amountPaid || 0;
            const balance = job.amount - amtPaid;
            
            const row = [
                job.dateReceived,
                `"${job.doctor}"`,
                `"${job.description}"`,
                job.units,
                `"${job.shade || '-'}"`,
                `"${job.techMetal || '-'}"`,
                `"${job.techBuildUp || '-'}"`,
                `"${job.messengerPickUp || '-'}"`,
                `"${job.messengerDeliver || '-'}"`,
                `"${job.dateDeliver || '-'}"`,
                job.amount,
                job.paymentStatus || 'Unpaid',
                amtPaid,
                balance,
                job.status
            ].join(",");
            
            csvContent += row + "\n";
        });

        // LOG THE EXPORT ACTION
        createLog("EXPORT", `Exported ${currentFilteredJobs.length} records to Excel.`);

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
        if (currentUserRole !== 'admin') {
            alert("You do not have permission to delete records.");
            return;
        }

        if (confirm("Are you sure you want to delete this lab job?")) {
            try {
                const snap = await get(ref(db, `sales/${jobId}`));
                const data = snap.val();
                
                await remove(ref(db, `sales/${jobId}`));
                
                // LOG THE DELETE
                await createLog("DELETE", `Deleted job for ${data.doctor} (${data.description})`);
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
                document.getElementById('editDescription').value = data.description;
                document.getElementById('editUnits').value = data.units || 0;
                document.getElementById('editShade').value = data.shade !== "-" ? data.shade : "";
                
                document.getElementById('editTechMetal').value = data.techMetal !== "-" ? data.techMetal : "";
                document.getElementById('editTechBuildUp').value = data.techBuildUp !== "-" ? data.techBuildUp : "";
                document.getElementById('editMessengerPickUp').value = data.messengerPickUp !== "-" ? data.messengerPickUp : "";
                document.getElementById('editMessengerDeliver').value = data.messengerDeliver !== "-" ? data.messengerDeliver : "";
                document.getElementById('editDateDeliver').value = data.dateDeliver !== "-" ? data.dateDeliver : "";

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
                
                // LOG THE PRINT ACTION
                await createLog("PRINT", `Printed receipt for ${data.doctor}`);

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({
                    orientation: "portrait",
                    unit: "in",
                    format: [4.25, 5.5]
                });

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("DENTAL LAB SYSTEM", 2.125, 0.4, { align: "center" }); 
                
                doc.setFontSize(9);
                doc.setFont("helvetica", "normal");
                doc.text(`Rec'd: ${data.dateReceived}`, 0.4, 0.7);
                doc.text(`Doctor: ${data.doctor}`, 0.4, 0.9);
                
                doc.line(0.4, 1.0, 3.85, 1.0); 
                
                doc.setFont("helvetica", "bold");
                doc.text("JOB DETAILS", 0.4, 1.2);
                doc.setFont("helvetica", "normal");
                doc.text(`Desc: ${data.description}`, 0.4, 1.4);
                doc.text(`Units: ${data.units} | Shade: ${data.shade}`, 0.4, 1.6);
                doc.text(`Tech (Metal): ${data.techMetal || '-'}`, 0.4, 1.8);
                doc.text(`Tech (Build Up): ${data.techBuildUp || '-'}`, 0.4, 2.0);
                
                doc.line(0.4, 2.1, 3.85, 2.1); 

                doc.setFont("helvetica", "bold");
                doc.text("LOGISTICS & STATUS", 0.4, 2.3);
                doc.setFont("helvetica", "normal");
                doc.text(`Pick Up: ${data.messengerPickUp || '-'} | Deliver: ${data.messengerDeliver || '-'}`, 0.4, 2.5);
                doc.text(`Date Delivered: ${data.dateDeliver || '-'}`, 0.4, 2.7);
                doc.text(`Job Status: ${data.status}`, 0.4, 2.9);

                doc.line(0.4, 3.0, 3.85, 3.0); 

                doc.setFont("helvetica", "bold");
                doc.text("BILLING INFO", 0.4, 3.2);
                doc.setFont("helvetica", "normal");
                const amtPaid = data.amountPaid || 0;
                const balance = data.amount - amtPaid;
                doc.text(`Total Amount: Php ${data.amount.toLocaleString()}`, 0.4, 3.4);
                doc.text(`Amount Paid: Php ${amtPaid.toLocaleString()}`, 0.4, 3.6);
                doc.text(`Balance: Php ${balance.toLocaleString()}`, 0.4, 3.8);
                doc.text(`Payment Status: ${data.paymentStatus || 'Unpaid'}`, 0.4, 4.0);

                doc.setFont("helvetica", "italic");
                doc.text("Thank you for your business!", 2.125, 4.7, { align: "center" });

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
            description: document.getElementById('editDescription').value,
            units: parseInt(document.getElementById('editUnits').value) || 0,
            shade: document.getElementById('editShade').value || "-",
            techMetal: document.getElementById('editTechMetal').value || "-",
            techBuildUp: document.getElementById('editTechBuildUp').value || "-",
            messengerPickUp: document.getElementById('editMessengerPickUp').value || "-",
            messengerDeliver: document.getElementById('editMessengerDeliver').value || "-",
            dateDeliver: document.getElementById('editDateDeliver').value || "-",
            amount: parseFloat(document.getElementById('editAmount').value) || 0,
            paymentStatus: document.getElementById('editPaymentStatus').value,
            amountPaid: parseFloat(document.getElementById('editAmountPaid').value) || 0,
        };

        try {
            await update(ref(db, `sales/${jobId}`), updatedData);
            
            // LOG THE UPDATE
            await createLog("UPDATE", `Updated job for ${updatedData.doctor}. Status: ${updatedData.status}`);

            editModalInstance.hide();
        } catch (error) {
            console.error("Error updating record: ", error);
            alert("Failed to update record.");
        }
    });
}