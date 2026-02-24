// js/sales.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, push, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let currentUserRole = 'staff'; 
let currentUserName = 'Unknown User';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; 
    } else {
        currentUserRole = localStorage.getItem('userRole') || 'staff';
        currentUserName = localStorage.getItem('userName') || user.email;
        
        const welcomeMessage = document.getElementById('welcomeMessage');
        if(welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserName}`;
    }
});

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

const addSaleForm = document.getElementById('addSaleForm');

if (addSaleForm) {
    addSaleForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const newJobData = {
            dateReceived: document.getElementById('dateReceived').value,
            dueDate: document.getElementById('dueDate').value || "-", 
            rxNumber: document.getElementById('rxNumber').value || "-", 
            doctor: document.getElementById('doctor').value,
            description: document.getElementById('description').value,
            units: parseInt(document.getElementById('units').value) || 0,
            shade: document.getElementById('shade').value || "-",
            techMetal: document.getElementById('techMetal').value || "-",
            techBuildUp: document.getElementById('techBuildUp').value || "-",
            messengerPickUp: document.getElementById('messengerPickUp').value || "-",
            messengerDeliver: document.getElementById('messengerDeliver').value || "-",
            dateDeliver: "-", 
            amount: parseFloat(document.getElementById('amount').value) || 0,
            paymentStatus: document.getElementById('paymentStatus').value,
            amountPaid: parseFloat(document.getElementById('amountPaid').value) || 0,
            remarks: "", 
            status: "In Progress", 
            timestamp: Date.now(),
            createdBy: auth.currentUser ? auth.currentUser.uid : "unknown"
        };

        try {
            const salesRef = ref(db, 'sales');
            const newSaleRef = push(salesRef);
            await set(newSaleRef, newJobData);

            await createLog("CREATE", `Added job for ${newJobData.doctor} (RX: ${newJobData.rxNumber})`);

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

const salesTableBody = document.getElementById('salesTableBody');
let allJobs = []; 
let currentFilteredJobs = []; 

function renderTable(jobsToRender) {
    salesTableBody.innerHTML = ''; 
    
    jobsToRender.forEach((job) => {
        const amountPaid = job.amountPaid || 0;
        const balance = job.amount - amountPaid;
        
        let paymentBadge = 'bg-danger';      
        let balanceTextClass = 'text-danger'; 

        if (job.paymentStatus === 'Paid') {
            paymentBadge = 'bg-success';      
            balanceTextClass = 'text-success'; 
        } else if (job.paymentStatus === 'Downpayment') {
            paymentBadge = 'bg-info text-dark'; 
            balanceTextClass = 'text-danger';     
        }

        let statusBadgeClass = 'bg-warning text-dark'; 
        if (job.status === 'Delivered') {
            statusBadgeClass = 'bg-success text-white'; 
        }

        // PURE READ-ONLY ACTION - ONLY PRINT BUTTON REMAINS
        let actionButtons = `
            <button class="btn btn-sm btn-light border print-btn shadow-sm" data-id="${job.id}" title="Print Receipt">🖨️ Print</button>
        `;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${job.dateReceived}</td>
            <td class="fw-bold text-danger">${job.dueDate || '-'}</td>
            <td class="fw-bold text-primary">${job.rxNumber || '-'}</td>
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
    
    allJobs.sort((a, b) => {
        const dateA = new Date(a.dateReceived || 0);
        const dateB = new Date(b.dateReceived || 0);
        if (dateB > dateA) return 1;
        if (dateB < dateA) return -1;
        return (b.timestamp || 0) - (a.timestamp || 0);
    });
    
    applyFilters();
});

const searchInput = document.getElementById('searchInput');
const filterPayment = document.getElementById('filterPayment');

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const paymentTerm = filterPayment.value;

    let filtered = allJobs.filter(job => {
        const matchesSearch = 
            (job.rxNumber && job.rxNumber.toLowerCase().includes(searchTerm)) || 
            job.doctor.toLowerCase().includes(searchTerm) || 
            job.description.toLowerCase().includes(searchTerm) ||
            (job.shade && job.shade.toLowerCase().includes(searchTerm)) ||
            (job.techMetal && job.techMetal.toLowerCase().includes(searchTerm)) ||
            (job.techBuildUp && job.techBuildUp.toLowerCase().includes(searchTerm));
        
        const jobPaymentStatus = job.paymentStatus || 'Unpaid';
        const matchesPayment = paymentTerm === "All" || jobPaymentStatus === paymentTerm;

        return matchesSearch && matchesPayment;
    });

    currentFilteredJobs = filtered;
    renderTable(currentFilteredJobs);
}

searchInput.addEventListener('input', applyFilters);
filterPayment.addEventListener('change', applyFilters);

const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        if (currentFilteredJobs.length === 0) {
            alert("No data available to export.");
            return;
        }

        let csvContent = "Date Received,Due Date,RX Number,Doctor,Description,Units,Shade,Technician (Metal),Technician (Build Up),Messenger (Pick Up),Messenger (Deliver),Date Delivered,Total Amount,Payment Status,Amount Paid,Balance,Job Status,Remarks\n";

        currentFilteredJobs.forEach(job => {
            const amtPaid = job.amountPaid || 0;
            const balance = job.amount - amtPaid;
            
            const row = [
                job.dateReceived,
                job.dueDate || '-',
                `"${job.rxNumber || '-'}"`, 
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
                job.status,
                `"${job.remarks || ''}"`
            ].join(",");
            
            csvContent += row + "\n";
        });

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

// Click Listeners for Print ONLY
salesTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    const jobId = target.getAttribute('data-id');
    if (!jobId) return;

    if (target.classList.contains('print-btn')) {
        try {
            const snapshot = await get(ref(db, `sales/${jobId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                await createLog("PRINT", `Printed receipt for ${data.doctor}`);

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF({ orientation: "portrait", unit: "in", format: [4.25, 5.5] });

                const drawReceipt = (logoDataUrl) => {
                    let yPos = 0.5;
                    if (logoDataUrl) {
                        const logoWidth = 3.0; 
                        const logoHeight = 1.0; 
                        const xPos = (4.25 - logoWidth) / 2;
                        doc.addImage(logoDataUrl, 'JPEG', xPos, yPos, logoWidth, logoHeight);
                        yPos += logoHeight + 0.2; 
                    } else {
                        doc.setFontSize(14);
                        doc.setFont("helvetica", "bold");
                        doc.text("FANO DENTAL LABORATORY", 2.125, yPos, { align: "center" }); 
                        yPos += 0.3;
                    }

                    doc.setLineWidth(0.01); 
                    doc.setDrawColor(0, 0, 0); 
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "normal");
                    doc.text(`Doctor: ${data.doctor}`, 0.4, yPos); yPos += 0.15;
                    
                    if(data.rxNumber && data.rxNumber !== "-") { doc.text(`RX Number: ${data.rxNumber}`, 0.4, yPos); yPos += 0.15; }
                    if(data.dueDate && data.dueDate !== "-") { doc.text(`Due Date: ${data.dueDate}`, 0.4, yPos); yPos += 0.1; }
                    
                    doc.line(0.4, yPos, 3.85, yPos); yPos += 0.2; 
                    doc.setFont("helvetica", "bold"); doc.text("JOB DETAILS", 0.4, yPos); yPos += 0.2;
                    doc.setFont("helvetica", "normal");
                    doc.text(`Desc: ${data.description}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Units: ${data.units} | Shade: ${data.shade}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Tech (Metal): ${data.techMetal || '-'}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Tech (Build Up): ${data.techBuildUp || '-'}`, 0.4, yPos); yPos += 0.1;
                    
                    doc.line(0.4, yPos, 3.85, yPos); yPos += 0.2; 
                    doc.setFont("helvetica", "bold"); doc.text("LOGISTICS & STATUS", 0.4, yPos); yPos += 0.2;
                    doc.setFont("helvetica", "normal");
                    doc.text(`Pick Up: ${data.messengerPickUp || '-'} | Deliver: ${data.messengerDeliver || '-'}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Date Delivered: ${data.dateDeliver || '-'}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Job Status: ${data.status}`, 0.4, yPos); yPos += 0.1;

                    doc.line(0.4, yPos, 3.85, yPos); yPos += 0.2; 
                    doc.setFont("helvetica", "bold"); doc.text("BILLING INFO", 0.4, yPos); yPos += 0.2;
                    doc.setFont("helvetica", "normal");
                    const amtPaid = data.amountPaid || 0;
                    const balance = data.amount - amtPaid;
                    doc.text(`Total Amount: Php ${data.amount.toLocaleString()}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Amount Paid: Php ${amtPaid.toLocaleString()}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Balance: Php ${balance.toLocaleString()}`, 0.4, yPos); yPos += 0.2;
                    doc.text(`Payment Status: ${data.paymentStatus || 'Unpaid'}`, 0.4, yPos); yPos += 0.5;

                    doc.setFont("helvetica", "italic"); doc.text("Thank you for trusting us!", 2.125, yPos, { align: "center" });
                    doc.save(`Receipt_${data.doctor.replace(/\s+/g, '_')}.pdf`);
                };

                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width; canvas.height = img.height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const pixels = imageData.data;
                    for (let i = 0; i < pixels.length; i += 4) {
                        pixels[i] = 255 - pixels[i]; pixels[i + 1] = 255 - pixels[i + 1]; pixels[i + 2] = 255 - pixels[i + 2]; 
                    }
                    ctx.putImageData(imageData, 0, 0);
                    drawReceipt(canvas.toDataURL('image/jpeg'));
                };
                img.onerror = function() { drawReceipt(null); };
                img.src = 'images/fano-logo.jpg'; 
            }
        } catch (error) {
            console.error("Error generating PDF: ", error); alert("Failed to generate receipt.");
        }
    }
});