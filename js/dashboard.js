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

    const todayObj = new Date();
    // Safe Local Date for "Today"
    const localYear = todayObj.getFullYear();
    const localMonth = String(todayObj.getMonth() + 1).padStart(2, '0');
    const localDay = String(todayObj.getDate()).padStart(2, '0');
    const todayStr = `${localYear}-${localMonth}-${localDay}`;
    const currentMonth = todayStr.substring(0, 7); 
    
    todayObj.setHours(0, 0, 0, 0);

    // --- SETUP LAST 7 DAYS FOR THE CHART ---
    const last7Dates = [];
    const chartLabels = [];
    const deliveredData = [0, 0, 0, 0, 0, 0, 0]; 

    const urgentJobs = [];

    // Build the last 7 days array based strictly on Local Time
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const lYear = d.getFullYear();
        const lMonth = String(d.getMonth() + 1).padStart(2, '0');
        const lDay = String(d.getDate()).padStart(2, '0');
        const dateString = `${lYear}-${lMonth}-${lDay}`;
        
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
            
            // SMART ALERT LOGIC
            if (job.dueDate && job.dueDate !== "-") {
                const parts = job.dueDate.split('-');
                if(parts.length === 3) {
                    const dueObj = new Date(parts[0], parts[1] - 1, parts[2]);
                    const timeDiff = dueObj.getTime() - todayObj.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    if (daysDiff <= 2) {
                        urgentJobs.push({
                            rxNumber: job.rxNumber, 
                            doctor: job.doctor,
                            desc: job.description,
                            dueDate: job.dueDate,
                            daysLeft: daysDiff
                        });
                    }
                }
            }
        } else if (job.status === "Delivered") {
            jobsDeliveredCount++;
            
            // CHART LOGIC: Map delivered jobs based on their Date Delivered
            if (job.dateDeliver && job.dateDeliver !== "-") {
                const dateIndex = last7Dates.indexOf(job.dateDeliver);
                if (dateIndex !== -1) {
                    deliveredData[dateIndex]++;
                }
            }
        }

        if (job.dateReceived === todayStr) totalSalesToday += amountPaid;
        if (job.dateReceived.startsWith(currentMonth)) totalSalesMonth += amountPaid;
        
        const balance = totalAmount - amountPaid;
        if (balance > 0) totalPendingPayments += balance;
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

    // Render the new simplified Production Chart
    renderProductionChart(chartLabels, deliveredData);
});

// --- SMART NOTIFICATION RENDERER ---
function updateNotifications(urgentJobs) {
    const notifBadge = document.getElementById('notificationCount');
    const notifList = document.getElementById('notificationList');

    if (!notifBadge || !notifList) return;

    if (urgentJobs.length > 0) {
        notifBadge.textContent = urgentJobs.length;
        notifBadge.style.display = 'inline-block';
        
        urgentJobs.sort((a, b) => a.daysLeft - b.daysLeft);
        notifList.innerHTML = ''; 
        
        urgentJobs.forEach(uJob => {
            let badgeColor = 'bg-warning text-dark';
            let labelText = `Due in ${uJob.daysLeft} Days`;
            
            if (uJob.daysLeft === 0) {
                badgeColor = 'bg-danger text-white';
                labelText = 'Due Today!';
            } else if (uJob.daysLeft < 0) {
                badgeColor = 'bg-danger text-white';
                labelText = `Overdue (${Math.abs(uJob.daysLeft)} Days)`;
            } else if (uJob.daysLeft === 1) {
                labelText = 'Due Tomorrow';
            }

            let searchQuery = (uJob.rxNumber && uJob.rxNumber !== "-") ? uJob.rxNumber : uJob.doctor;
            let targetUrl = `duedate.html?search=${encodeURIComponent(searchQuery)}`;

            let rxDisplay = (uJob.rxNumber && uJob.rxNumber !== "-") ? `<small class="text-info ms-1">(${uJob.rxNumber})</small>` : "";

            notifList.innerHTML += `
                <li>
                    <a href="${targetUrl}" class="dropdown-item border-bottom border-secondary py-2 text-decoration-none" style="white-space: normal; display: block;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong class="text-white">${uJob.doctor} ${rxDisplay}</strong>
                            <span class="badge ${badgeColor}">${labelText}</span>
                        </div>
                        <small class="text-white-50 d-block">${uJob.desc}</small>
                        <small class="text-info" style="font-size: 0.75rem;">Due: ${uJob.dueDate}</small>
                    </a>
                </li>
            `;
        });
    } else {
        notifBadge.style.display = 'none';
        notifList.innerHTML = `<li><span class="dropdown-item text-muted text-center py-3">No urgent jobs right now. You're all caught up!</span></li>`;
    }
}

// --- 3. MODERN CHART RENDERING FUNCTION ---
function renderProductionChart(labels, deliveredData) {
    const canvas = document.getElementById('statusSalesChart');
    if (!canvas) return; 
    
    const ctx = canvas.getContext('2d');

    if (statusChartInstance) {
        statusChartInstance.destroy(); 
    }

    Chart.defaults.color = '#a0aec0';
    Chart.defaults.font.family = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    const deliveredGradient = ctx.createLinearGradient(0, 0, 0, 300);
    deliveredGradient.addColorStop(0, 'rgba(0, 209, 255, 0.4)'); // Cyan fade
    deliveredGradient.addColorStop(1, 'rgba(0, 209, 255, 0.0)');

    statusChartInstance = new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Delivered Items',
                    data: deliveredData,
                    backgroundColor: deliveredGradient,
                    borderColor: '#00d1ff', 
                    borderWidth: 3,
                    pointBackgroundColor: '#1e293b',
                    pointBorderColor: '#00d1ff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { 
                    position: 'top',
                    align: 'end',
                    labels: { 
                        color: '#ffffff', 
                        font: { weight: '600', size: 13 },
                        usePointStyle: true, 
                        boxWidth: 8
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 4,
                    usePointStyle: true
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: false },
                    ticks: { 
                        color: '#64748b', 
                        stepSize: 1,
                        padding: 10
                    },
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false 
                    },
                    border: { display: false }
                },
                x: {
                    ticks: { 
                        color: '#94a3b8', 
                        font: { weight: '500' },
                        padding: 10
                    },
                    grid: { 
                        display: false, 
                        drawBorder: false
                    },
                    border: { display: false }
                }
            }
        }
    });
}