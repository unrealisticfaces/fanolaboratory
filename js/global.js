// js/global.js

import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// --- 1. COLLAPSIBLE SIDEBAR LOGIC (Responsive Mobile & Desktop) ---
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (sidebarToggle && sidebar && mainContent) {
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            // MOBILE: Slide sidebar in and show dark overlay
            sidebar.classList.toggle('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.toggle('show');
        } else {
            // DESKTOP: Collapse sidebar and stretch main content
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        }
    });

    // MOBILE: Close sidebar if user taps the dark overlay background
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('show');
        });
    }

    // Auto-fix layout if someone resizes the browser window
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('show');
        }
    });
}

// --- 2. LIGHT / DARK MODE TOGGLE ---
const htmlElement = document.documentElement;
const themeToggleBtn = document.getElementById('themeToggleBtn');

const currentTheme = htmlElement.getAttribute('data-bs-theme') || 'dark';
if (themeToggleBtn) themeToggleBtn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const activeTheme = htmlElement.getAttribute('data-bs-theme');
        const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
}

// --- 3. GLOBAL LOGOUT BUTTON ---
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

// --- 4. GLOBAL ALERT NOTIFICATIONS ---
const salesRef = ref(db, 'sales');
onValue(salesRef, (snapshot) => {
    const urgentJobs = [];
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    snapshot.forEach((childSnapshot) => {
        const job = childSnapshot.val();
        if (job.status === "In Progress" && job.dueDate && job.dueDate !== "-") {
            const parts = job.dueDate.split('-');
            if (parts.length === 3) {
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
    });

    const notifBadge = document.getElementById('notificationCount');
    const notifList = document.getElementById('notificationList');

    if (notifBadge && notifList) {
        if (urgentJobs.length > 0) {
            notifBadge.textContent = urgentJobs.length;
            notifBadge.style.display = 'inline-block';
            
            urgentJobs.sort((a, b) => a.daysLeft - b.daysLeft);
            notifList.innerHTML = ''; 
            
            urgentJobs.forEach(uJob => {
                let badgeColor = 'bg-warning text-dark';
                let labelText = `Due in ${uJob.daysLeft} Days`;
                
                if (uJob.daysLeft === 0) { badgeColor = 'bg-danger text-white'; labelText = 'Due Today!'; } 
                else if (uJob.daysLeft < 0) { badgeColor = 'bg-danger text-white'; labelText = `Overdue (${Math.abs(uJob.daysLeft)} Days)`; } 
                else if (uJob.daysLeft === 1) { labelText = 'Due Tomorrow'; }

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
                            <small class="text-body-secondary d-block">${uJob.desc}</small>
                            <small class="text-info-emphasis" style="font-size: 0.75rem;">Due: ${uJob.dueDate}</small>
                        </a>
                    </li>
                `;
            });
        } else {
            notifBadge.style.display = 'none';
            notifList.innerHTML = `<li><span class="dropdown-item text-muted text-center py-3">No urgent jobs right now!</span></li>`;
        }
    }
});