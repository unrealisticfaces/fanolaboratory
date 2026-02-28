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

// Store chart data globally so we can redraw it instantly when theme changes
let savedChartLabels = [];
let savedDeliveredData = [];

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
    savedChartLabels = [];
    savedDeliveredData = [0, 0, 0, 0, 0, 0, 0]; 

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
        savedChartLabels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })); 
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

                    // ONLY show Due Tomorrow (1), Due Today (0), or Overdue (<0)
                    if (daysDiff <= 1) {
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
            
            // CHART LOGIC: Map delivered jobs
            if (job.dateDeliver && job.dateDeliver !== "-") {
                const dateIndex = last7Dates.indexOf(job.dateDeliver);
                if (dateIndex !== -1) {
                    savedDeliveredData[dateIndex]++;
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

    // Render the Chart initially
    renderProductionChart(savedChartLabels, savedDeliveredData);
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
                    <a href="${targetUrl}" class="dropdown-item border-bottom py-2 text-decoration-none" style="white-space: normal; display: block;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <strong>${uJob.doctor} ${rxDisplay}</strong>
                            <span class="badge ${badgeColor}">${labelText}</span>
                        </div>
                        <small class="text-muted d-block">${uJob.desc}</small>
                        <small class="text-info" style="font-size: 0.75rem;">Due: ${uJob.dueDate}</small>
                    </a>
                </li>
            `;
        });
    } else {
        notifBadge.style.display = 'none';
        notifList.innerHTML = `<li><span class="dropdown-item text-muted text-center py-3">No urgent jobs right now!</span></li>`;
    }
}

// --- 3. DYNAMIC MODERN SMOOTH AREA CHART ---
function renderProductionChart(labels, deliveredData) {
    const canvas = document.getElementById('statusSalesChart');
    if (!canvas) return; 
    
    const ctx = canvas.getContext('2d');

    if (statusChartInstance) {
        statusChartInstance.destroy(); 
    }

    // CHECK CURRENT THEME dynamically
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    
    // Dynamic Colors based on theme
    const mainTextColor = isDark ? '#ffffff' : '#212529';
    const mutedTextColor = isDark ? '#94a3b8' : '#6c757d';
    const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const pointBgColor = isDark ? '#1e293b' : '#ffffff';

    Chart.defaults.color = mutedTextColor;
    Chart.defaults.font.family = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    const deliveredGradient = ctx.createLinearGradient(0, 0, 0, 300);
    deliveredGradient.addColorStop(0, 'rgba(0, 209, 255, 0.4)'); 
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
                    pointBackgroundColor: pointBgColor,
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
                        color: mainTextColor, 
                        font: { weight: '600', size: 13 },
                        usePointStyle: true, 
                        boxWidth: 8
                    } 
                },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: mainTextColor,
                    bodyColor: mutedTextColor,
                    borderColor: tooltipBorder,
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
                        color: mutedTextColor, 
                        stepSize: 1,
                        padding: 10
                    },
                    grid: { 
                        color: gridLineColor, 
                        drawBorder: false 
                    },
                    border: { display: false }
                },
                x: {
                    ticks: { 
                        color: mutedTextColor, 
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

// --- 4. REDRAW CHART INSTANTLY WHEN THEME IS TOGGLED ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        // Wait exactly 50 milliseconds for the HTML attribute to switch to 'light' or 'dark'
        // Then re-run the chart generator so it grabs the fresh colors!
        setTimeout(() => {
            if (savedChartLabels.length > 0) {
                renderProductionChart(savedChartLabels, savedDeliveredData);
            }
        }, 50);
    });
}