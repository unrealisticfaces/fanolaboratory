// js/audit.js

import { db } from './firebase-config.js';
import { ref, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const auditLogBody = document.getElementById('auditLogBody');

// We query the 'audit_logs' node and limit it to the last 100 entries to keep it fast
const auditRef = query(ref(db, 'audit_logs'), limitToLast(100));

onValue(auditRef, (snapshot) => {
    auditLogBody.innerHTML = '';
    const logs = [];
    
    // Firebase returns items in chronological order; we want newest first
    snapshot.forEach((child) => {
        logs.unshift(child.val()); 
    });

    logs.forEach(log => {
        const row = document.createElement('tr');
        
        // Dynamic color for the Action Badge
        let badgeClass = 'bg-info text-dark'; // Default for Read/Print
        if (log.action === 'CREATE') badgeClass = 'bg-success';
        if (log.action === 'UPDATE') badgeClass = 'bg-warning text-dark';
        if (log.action === 'DELETE') badgeClass = 'bg-danger';

        row.innerHTML = `
            <td><small class="text-muted">${log.timestamp}</small></td>
            <td><strong>${log.user}</strong></td>
            <td><span class="badge ${badgeClass}">${log.action}</span></td>
            <td>${log.details}</td>
        `;
        auditLogBody.appendChild(row);
    });
});