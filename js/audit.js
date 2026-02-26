// js/audit.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// ADDED query and limitToLast to prevent downloading the whole database at once!
import { ref, onValue, remove, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let currentUserRole = 'staff';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; 
    } else {
        currentUserRole = localStorage.getItem('userRole') || 'staff';
        
        // Show "Clear Logs" button ONLY if the user is an Admin
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (currentUserRole === 'admin' && clearLogsBtn) {
            clearLogsBtn.style.display = 'inline-block';
        }
    }
});

const auditLogBody = document.getElementById('auditLogBody');
const logCountEl = document.getElementById('logCount');
const actionFilter = document.getElementById('actionFilter');
const searchInput = document.getElementById('searchInput');

let allLogs = [];

// OPTIMIZATION: Instead of fetching ALL logs, we only fetch the latest 200
const logsRef = query(ref(db, 'audit_logs'), limitToLast(200));

onValue(logsRef, (snapshot) => {
    allLogs = [];
    snapshot.forEach((childSnapshot) => {
        const log = childSnapshot.val();
        log.id = childSnapshot.key;
        allLogs.push(log);
    });

    // Sort newest first
    allLogs.reverse(); 
    applyFilters();
});

function applyFilters() {
    const actionTerm = actionFilter.value;
    const searchTerm = searchInput.value.toLowerCase();

    const filtered = allLogs.filter(log => {
        const matchAction = actionTerm === 'All' || log.action === actionTerm;
        const matchSearch = 
            (log.user && log.user.toLowerCase().includes(searchTerm)) ||
            (log.details && log.details.toLowerCase().includes(searchTerm));
        
        return matchAction && matchSearch;
    });

    renderTable(filtered);
}

function renderTable(logs) {
    auditLogBody.innerHTML = '';
    logCountEl.textContent = logs.length;

    if (logs.length === 0) {
        auditLogBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No logs found.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        let actionBadge = 'bg-secondary';
        if (log.action === 'CREATE') actionBadge = 'bg-success';
        if (log.action === 'UPDATE') actionBadge = 'bg-warning text-dark';
        if (log.action === 'DELETE') actionBadge = 'bg-danger';
        if (log.action === 'PRINT') actionBadge = 'bg-info text-dark';
        if (log.action === 'EXPORT') actionBadge = 'bg-primary';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-body-secondary small">${log.timestamp}</td>
            <td class="fw-bold">${log.user}</td>
            <td><span class="badge ${actionBadge}">${log.action}</span></td>
            <td class="text-body-emphasis">${log.details}</td>
        `;
        auditLogBody.appendChild(row);
    });
}

if (actionFilter) actionFilter.addEventListener('change', applyFilters);
if (searchInput) searchInput.addEventListener('input', applyFilters);

// ADMIN FEATURE: Clear all logs
const clearLogsBtn = document.getElementById('clearLogsBtn');
if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', async () => {
        if (currentUserRole !== 'admin') {
            alert("Only administrators can clear audit logs.");
            return;
        }

        const confirmClear = confirm("⚠️ WARNING: This will permanently delete ALL audit logs. This cannot be undone. Do you want to proceed?");
        if (confirmClear) {
            try {
                await remove(ref(db, 'audit_logs'));
                alert("Audit logs successfully cleared.");
            } catch (error) {
                console.error("Error clearing logs:", error);
                alert("Failed to clear logs.");
            }
        }
    });
}