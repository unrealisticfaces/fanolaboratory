// js/audit.js

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, onValue, remove, push, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let currentUserRole = 'staff';
let currentUserName = 'Unknown User';

// --- AUTHENTICATION & ROLE CHECK ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; 
    } else {
        // Fetch role and name from LocalStorage
        currentUserRole = localStorage.getItem('userRole') || 'staff';
        currentUserName = localStorage.getItem('userName') || user.email;

        // If the user is an admin, reveal the "Clear Logs" button
        if (currentUserRole === 'admin') {
            const clearLogsBtn = document.getElementById('clearLogsBtn');
            if (clearLogsBtn) clearLogsBtn.style.display = 'inline-block';
        }
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

// --- DOM ELEMENTS ---
const auditLogBody = document.getElementById('auditLogBody');
const searchInput = document.getElementById('searchInput');
const actionFilter = document.getElementById('actionFilter');
const logCount = document.getElementById('logCount');

let allLogs = [];

// --- FETCH AUDIT LOGS ---
const logsRef = ref(db, 'audit_logs');
onValue(logsRef, (snapshot) => {
    allLogs = [];
    snapshot.forEach((childSnapshot) => {
        const log = childSnapshot.val();
        log.id = childSnapshot.key;
        
        log.parsedTime = new Date(log.timestamp).getTime() || 0;
        
        allLogs.push(log);
    });

    allLogs.sort((a, b) => b.parsedTime - a.parsedTime);
    applyFilters();
});

// --- FILTER LOGIC ---
actionFilter.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const actionTerm = actionFilter.value;

    const filtered = allLogs.filter(log => {
        if (actionTerm !== "All" && log.action !== actionTerm) {
            return false;
        }
        if (searchTerm) {
            return (
                (log.user && log.user.toLowerCase().includes(searchTerm)) ||
                (log.details && log.details.toLowerCase().includes(searchTerm)) ||
                (log.timestamp && log.timestamp.toLowerCase().includes(searchTerm))
            );
        }
        return true;
    });

    renderTable(filtered);
}

// --- RENDER TABLE ---
function renderTable(logs) {
    auditLogBody.innerHTML = '';
    logCount.textContent = logs.length;

    if (logs.length === 0) {
        auditLogBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No audit logs found matching your criteria.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        let actionBadge = 'bg-secondary';
        
        if (log.action === "CREATE") actionBadge = 'bg-primary';
        else if (log.action === "UPDATE") actionBadge = 'bg-warning text-dark';
        else if (log.action === "DELETE") actionBadge = 'bg-danger';
        else if (log.action === "PRINT") actionBadge = 'bg-info text-dark';
        else if (log.action === "EXPORT") actionBadge = 'bg-success';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-muted">${log.timestamp}</td>
            <td class="fw-bold">${log.user || 'Unknown'}</td>
            <td><span class="badge ${actionBadge}">${log.action}</span></td>
            <td>${log.details}</td>
        `;
        auditLogBody.appendChild(row);
    });
}

// --- CLEAR ALL LOGS (ADMIN ONLY) ---
const clearLogsBtn = document.getElementById('clearLogsBtn');
if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', async () => {
        // Double check permission
        if (currentUserRole !== 'admin') {
            alert("Unauthorized: Only administrators can clear audit logs.");
            return;
        }

        // Warning 1
        const confirmDelete = confirm("⚠️ WARNING: Are you sure you want to delete ALL audit logs?\n\nThis action cannot be undone.");
        
        if (confirmDelete) {
            // Warning 2 (Double confirmation to prevent accidental clicks)
            const doubleConfirm = confirm("Are you absolutely sure? Click OK to permanently wipe the log database.");
            
            if (doubleConfirm) {
                try {
                    // Delete all logs
                    await remove(logsRef);
                    
                    // Create a single new log so there's a record that the admin cleared the system
                    const newLogRef = push(logsRef);
                    await set(newLogRef, {
                        timestamp: new Date().toLocaleString(),
                        user: currentUserName,
                        action: "DELETE",
                        details: "ADMIN ACTION: Cleared all previous system audit logs."
                    });

                    alert("System logs have been successfully wiped.");
                } catch (error) {
                    console.error("Error clearing logs: ", error);
                    alert("Failed to clear logs. Check your database permissions.");
                }
            }
        }
    });
}