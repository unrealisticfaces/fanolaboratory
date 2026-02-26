// js/payment.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, update, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let currentUserName = 'Unknown User';

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html'; 
    else currentUserName = localStorage.getItem('userName') || user.email;
});

async function createLog(action, details) {
    try {
        const logRef = ref(db, 'audit_logs');
        await set(push(logRef), { timestamp: new Date().toLocaleString(), user: currentUserName, action: action, details: details });
    } catch (error) { console.error("Audit Log Error:", error); }
}

const searchInput = document.getElementById('searchInput');
const paymentTableBody = document.getElementById('paymentTableBody');
const totalPendingValue = document.getElementById('totalPendingValue');

let unpaidJobs = [];

const salesRef = ref(db, 'sales');
onValue(salesRef, (snapshot) => {
    unpaidJobs = []; 
    let globalPendingTotal = 0;

    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        const totalAmount = parseFloat(job.amount) || 0;
        const amountPaid = parseFloat(job.amountPaid) || 0;
        const balance = totalAmount - amountPaid;

        // ONLY grab jobs that have an outstanding balance > 0
        if (balance > 0) {
            job.id = childSnapshot.key; 
            job.calculatedBalance = balance;
            unpaidJobs.push(job);
            globalPendingTotal += balance;
        }
    });

    if (totalPendingValue) totalPendingValue.textContent = `₱${globalPendingTotal.toLocaleString()}`;
    
    // Sort oldest received dates first so oldest debts show at the top
    unpaidJobs.sort((a, b) => new Date(a.dateReceived) - new Date(b.dateReceived));
    applyFilters();
});

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();

    let filtered = unpaidJobs.filter(job => {
        if (searchTerm) {
            return (
                job.doctor.toLowerCase().includes(searchTerm) || 
                (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) ||
                job.description.toLowerCase().includes(searchTerm)
            );
        }
        return true;
    });

    renderTable(filtered);
}

searchInput.addEventListener('input', applyFilters);

function renderTable(jobs) {
    paymentTableBody.innerHTML = ''; 

    if (jobs.length === 0) {
        paymentTableBody.innerHTML = `<tr><td colspan="10" class="text-center text-success py-4 fs-5 fw-bold">🎉 All accounts are Paid in Full!</td></tr>`;
        return;
    }
    
    jobs.forEach((job) => {
        let statusBadgeClass = job.status === 'Delivered' ? 'text-bg-success' : 'text-bg-warning';
        let paymentBadge = job.paymentStatus === 'Downpayment' ? 'text-bg-info' : 'text-bg-danger';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${job.dateReceived}</td>
            <td class="text-info-emphasis fw-bold">${job.rxNumber || '-'}</td>
            <td class="fw-bold">${job.doctor}</td>
            <td>${job.description}</td>
            <td class="fw-bold">₱${(parseFloat(job.amount) || 0).toLocaleString()}</td>
            <td class="text-success fw-bold">₱${(parseFloat(job.amountPaid) || 0).toLocaleString()}</td>
            <td class="text-danger fw-bold fs-6">₱${job.calculatedBalance.toLocaleString()}</td>
            <td><span class="badge ${paymentBadge}">${job.paymentStatus || 'Unpaid'}</span></td>
            <td><span class="badge ${statusBadgeClass}">${job.status}</span></td>
            <td>
                <button class="btn btn-sm btn-success pay-btn shadow-sm fw-bold" data-id="${job.id}">💳 Add Payment</button>
            </td>
        `;
        paymentTableBody.appendChild(row);
    });
}

const updatePaymentForm = document.getElementById('updatePaymentForm');
const payAddAmountInput = document.getElementById('payAddAmount');
const payNewStatusSelect = document.getElementById('payNewStatus');
let paymentModalInstance;
let currentSelectedJob = null;

// Open Modal Logic
paymentTableBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('pay-btn')) {
        const jobId = e.target.getAttribute('data-id');
        currentSelectedJob = unpaidJobs.find(j => j.id === jobId);
        
        if (currentSelectedJob) {
            document.getElementById('payJobId').value = jobId;
            document.getElementById('payDoctorName').textContent = `Dr. ${currentSelectedJob.doctor}`;
            document.getElementById('payJobDesc').textContent = `RX: ${currentSelectedJob.rxNumber || '-'} | ${currentSelectedJob.description}`;
            
            document.getElementById('payTotalAmount').textContent = `₱${parseFloat(currentSelectedJob.amount || 0).toLocaleString()}`;
            document.getElementById('payCurrentPaid').textContent = `₱${parseFloat(currentSelectedJob.amountPaid || 0).toLocaleString()}`;
            document.getElementById('payCurrentBalance').textContent = `₱${currentSelectedJob.calculatedBalance.toLocaleString()}`;

            payAddAmountInput.value = "";
            payAddAmountInput.max = currentSelectedJob.calculatedBalance; // Prevent overpaying
            payNewStatusSelect.value = "Downpayment";

            paymentModalInstance = new bootstrap.Modal(document.getElementById('updatePaymentModal'));
            paymentModalInstance.show();
        }
    }
});

// Auto-select "Paid in Full" if they type the exact remaining balance
payAddAmountInput.addEventListener('input', () => {
    if (!currentSelectedJob) return;
    const addedAmount = parseFloat(payAddAmountInput.value) || 0;
    if (addedAmount >= currentSelectedJob.calculatedBalance) {
        payNewStatusSelect.value = "Paid";
    } else {
        payNewStatusSelect.value = "Downpayment";
    }
});

// Handle Submission
if (updatePaymentForm) {
    updatePaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('savePaymentBtn');
        saveBtn.innerText = "Processing..."; 
        saveBtn.disabled = true;

        const jobId = document.getElementById('payJobId').value;
        const addedAmount = parseFloat(payAddAmountInput.value) || 0;
        const newStatus = payNewStatusSelect.value;

        if (addedAmount <= 0) {
            alert("Please enter a valid payment amount greater than 0.");
            saveBtn.innerText = "Confirm Payment"; saveBtn.disabled = false;
            return;
        }

        const oldPaid = parseFloat(currentSelectedJob.amountPaid) || 0;
        const newTotalPaid = oldPaid + addedAmount;

        try {
            await update(ref(db, `sales/${jobId}`), {
                amountPaid: newTotalPaid,
                paymentStatus: newStatus
            });

            await createLog("UPDATE", `Added payment of ₱${addedAmount.toLocaleString()} to RX: ${currentSelectedJob.rxNumber || '-'} (Dr. ${currentSelectedJob.doctor}). New Status: ${newStatus}`);
            
            alert(`Payment successful! Updated status to ${newStatus}.`);
            paymentModalInstance.hide();
        } catch (error) {
            console.error("Payment Error: ", error);
            alert("Failed to process payment.");
        } finally {
            saveBtn.innerText = "Confirm Payment";
            saveBtn.disabled = false;
        }
    });
}