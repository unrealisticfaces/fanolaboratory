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
    let jobsDeliveredCount = 0; 
    let totalPendingPayments = 0; 

    // Setup Dates
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = todayStr.substring(0, 7); 
    
    // Create Date object for today at Midnight to calculate exact day differences
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    // --- SETUP LAST 7 DAYS FOR THE CHART ---
    const last7Dates = [];
    const chartLabels = [];
    const inProgressData = [0, 0, 0, 0, 0, 0, 0];
    const deliveredData = [0, 0, 0, 0, 0, 0, 0]; 

    // SMART ALERT ARRAY
    const urgentJobs = [];

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
            
            // SMART ALERT LOGIC: Check Due Dates for "In Progress" jobs
            if (job.dueDate && job.dueDate !== "-") {
                const dueObj = new Date(job.dueDate);
                // Calculate difference in time, then convert to Days
                const timeDiff = dueObj.getTime() - todayObj.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                // If due in 2 days, 1 day, today (0), or overdue (negative numbers)
                if (daysDiff <= 2) {
                    urgentJobs.push({
                        doctor: job.doctor,
                        desc: job.description,
                        dueDate: job.dueDate,
                        daysLeft: daysDiff
                    });
                }
            }

        } else if (job.status === "Delivered") {
            jobsDeliveredCount++;
        }

        if (job.dateReceived === todayStr) totalSalesToday += amountPaid;
        if (job.dateReceived.startsWith(currentMonth)) totalSalesMonth += amountPaid;
        
        const balance = totalAmount - amountPaid;
        if (balance > 0) totalPendingPayments += balance;

        // --- B. CHART LOGIC (Last 7 Days) ---
        const dateIndex = last7Dates.indexOf(job.dateReceived);

        if (dateIndex !== -1) {
            if (job.status === 'In Progress') {
                inProgressData[dateIndex]++;
            } else if (job.status === 'Delivered') {
                deliveredData[dateIndex]++;
            }
        }
    });

    // --- C. UPDATE SMART ALERTS UI ---
    updateNotifications(urgentJobs);

    // Update HTML cards
    const salesTodayEl = document.getElementById('salesToday');
    if (salesTodayEl) salesTodayEl.textContent = `₱${totalSalesToday.toLocaleString()}`;
    
    const salesMonthEl = document.getElementById('salesMonth');
    if (salesMonthEl) salesMonthEl.textContent = `₱${totalSalesMonth.toLocaleString()}`;
    
    const jobsInProgressEl = document.getElementById('jobsInProgress');
    if (jobsInProgressEl) jobsInProgressEl.textContent = jobsInProgressCount;

    const jobsDeliveredEl = document.getElementById('jobsDelivered');
    if (jobsDeliveredEl) jobsDeliveredEl.textContent = jobsDeliveredCount;
    
    const pendingPaymentsEl = document.getElementById('pendingPayments');
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = `₱${totalPendingPayments.toLocaleString()}`; 

    // Render the new Production Chart (2 bars)
    renderProductionChart(chartLabels, inProgressData, deliveredData);
});

// --- SMART NOTIFICATION RENDERER ---
function updateNotifications(urgentJobs) {
    const notifBadge = document.getElementById('notificationCount');
    const notifList = document.getElementById('notificationList');

    if (!notifBadge || !notifList) return;

    if (urgentJobs.length > 0) {
        // Show Badge Number
        notifBadge.textContent = urgentJobs.length;
        notifBadge.style.display = 'inline-block';
        
        // Sort the most urgent jobs (Overdue/Due Today) to the top
        urgentJobs.sort((a, b) => a.daysLeft - b.daysLeft);

        notifList.innerHTML = ''; // Clear empty state
        
        urgentJobs.forEach(uJob => {
            let badgeColor = 'bg-warning text-dark';
            let labelText = `Due in ${uJob.daysLeft} Days`;
            
            // Color Coding based on urgency
            if (uJob.daysLeft === 0) {
                badgeColor = 'bg-danger text-white';
                labelText = 'Due Today!';
            } else if (uJob.daysLeft < 0) {
                badgeColor = 'bg-danger text-white';
                labelText = `Overdue (${Math.abs(uJob.daysLeft)} Days)`;
            } else if (uJob.daysLeft === 1) {
                labelText = 'Due Tomorrow';
            }

            notifList.innerHTML += `
                <li>
                    <div class="dropdown-item border-bottom border-secondary py-2" style="white-space: normal;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong class="text-white">${uJob.doctor}</strong>
                            <span class="badge ${badgeColor}">${labelText}</span>
                        </div>
                        <small class="text-white-50 d-block">${uJob.desc}</small>
                        <small class="text-info" style="font-size: 0.75rem;">Due: ${uJob.dueDate}</small>
                    </div>
                </li>
            `;
        });
    } else {
        // Hide Badge and show empty state
        notifBadge.style.display = 'none';
        notifList.innerHTML = `<li><span class="dropdown-item text-muted text-center py-3">No urgent jobs right now. You're all caught up!</span></li>`;
    }
}

// --- 3. CHART RENDERING FUNCTION ---
function renderProductionChart(labels, inProgressData, deliveredData) {
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