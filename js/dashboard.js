// js/dashboard.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userName = localStorage.getItem('userName') || user.email;
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${userName}`;
    } else {
        window.location.href = 'index.html';
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

// --- 2. COMPUTE DASHBOARD ANALYTICS & CHART DATA ---
const salesRef = ref(db, 'sales');
let statusChartInstance = null; 

onValue(salesRef, (snapshot) => {
    // Top Card Metrics
    let totalSalesToday = 0;
    let totalSalesMonth = 0;
    let jobsInProgressCount = 0;
    let jobsCompletedCount = 0; 
    let jobsDeliveredCount = 0; 
    let totalPendingPayments = 0; 

    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); 

    // --- SETUP LAST 7 DAYS FOR THE CHART ---
    const last7Dates = [];
    const chartLabels = [];
    const inProgressData = [0, 0, 0, 0, 0, 0, 0];
    const completedData = [0, 0, 0, 0, 0, 0, 0];
    const deliveredData = [0, 0, 0, 0, 0, 0, 0]; 

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0]; 
        last7Dates.push(dateString);
        chartLabels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); 
    }

    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        const amountPaid = parseFloat(job.amountPaid) || 0; 
        const totalAmount = parseFloat(job.amount) || 0;

        // --- A. TOP CARDS LOGIC ---
        if (job.status === "In Progress") {
            jobsInProgressCount++;
        } else if (job.status === "Completed") {
            jobsCompletedCount++;
        } else if (job.status === "Delivered") {
            jobsDeliveredCount++;
        }

        if (job.dateReceived === today) totalSalesToday += amountPaid;
        if (job.dateReceived.startsWith(currentMonth)) totalSalesMonth += amountPaid;
        
        const balance = totalAmount - amountPaid;
        if (balance > 0) totalPendingPayments += balance;

        // --- B. CHART LOGIC (Last 7 Days) ---
        const dateIndex = last7Dates.indexOf(job.dateReceived);

        if (dateIndex !== -1) {
            if (job.status === 'In Progress') {
                inProgressData[dateIndex]++;
            } else if (job.status === 'Completed') {
                completedData[dateIndex]++;
            } else if (job.status === 'Delivered') {
                deliveredData[dateIndex]++;
            }
        }
    });

    // Update HTML cards
    const salesTodayEl = document.getElementById('salesToday');
    if (salesTodayEl) salesTodayEl.textContent = `₱${totalSalesToday.toLocaleString()}`;
    
    const salesMonthEl = document.getElementById('salesMonth');
    if (salesMonthEl) salesMonthEl.textContent = `₱${totalSalesMonth.toLocaleString()}`;
    
    const jobsInProgressEl = document.getElementById('jobsInProgress');
    if (jobsInProgressEl) jobsInProgressEl.textContent = jobsInProgressCount;

    const jobsCompletedEl = document.getElementById('jobsCompleted');
    if (jobsCompletedEl) jobsCompletedEl.textContent = jobsCompletedCount;

    const jobsDeliveredEl = document.getElementById('jobsDelivered');
    if (jobsDeliveredEl) jobsDeliveredEl.textContent = jobsDeliveredCount;
    
    const pendingPaymentsEl = document.getElementById('pendingPayments');
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = `₱${totalPendingPayments.toLocaleString()}`; 

    // Render the new Production Chart
    renderProductionChart(chartLabels, inProgressData, completedData, deliveredData);
});

// --- 3. CHART RENDERING FUNCTION (3 BARS) ---
function renderProductionChart(labels, inProgressData, completedData, deliveredData) {
    const ctx = document.getElementById('statusSalesChart');
    if (!ctx) return; 

    if (statusChartInstance) {
        statusChartInstance.destroy(); 
    }

    Chart.defaults.color = '#a0aec0';

    statusChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'In Progress',
                    data: inProgressData,
                    backgroundColor: 'rgba(255, 193, 7, 0.8)', // Yellow
                    borderColor: '#ffc107',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Completed (In Lab)',
                    data: completedData,
                    backgroundColor: 'rgba(13, 110, 253, 0.8)', // Primary Blue
                    borderColor: '#0d6efd',
                    borderWidth: 2,
                    borderRadius: 4
                },
                {
                    label: 'Delivered',
                    data: deliveredData,
                    backgroundColor: 'rgba(25, 135, 84, 0.8)', // Success Green
                    borderColor: '#198754',
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { labels: { color: '#ffffff', font: { weight: 'bold' } } },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#00d1ff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    title: { display: true, text: 'Number of Lab Jobs', color: '#ffffff', font: { weight: 'bold' } },
                    ticks: { 
                        color: '#a0aec0', 
                        stepSize: 1,
                        beginAtZero: true
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                },
                x: {
                    ticks: { color: '#ffffff', font: { size: 12, weight: 'bold' } },
                    grid: { display: false }
                }
            }
        }
    });
}