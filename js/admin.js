/* ==========================================================================
   Admin Panel & Analytics Controller
   Chart.js Visualization & User Verification Management
   ========================================================================== */

import { localDb } from './firebase-config.js';
import { updateUserProfile } from './auth.js';

let chartInstance = null;

export function renderAdminDashboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allUsers = localDb.getUsers();
    const allReqs = localDb.getRequests();
    
    const donorsCount = allUsers.filter(u => u.role === 'donor').length;
    const activeDonorsCount = allUsers.filter(u => u.role === 'donor' && u.isAvailable).length;
    const pendingReqsCount = allReqs.filter(r => r.status === 'OPEN').length;
    const emergencyCount = allReqs.filter(r => r.status === 'OPEN' && r.emergencyLevel === 'CRITICAL').length;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="glass-card stat-card">
                <div class="stat-icon green">🩸</div>
                <div>
                    <div class="stat-value">${donorsCount}</div>
                    <div class="stat-label">Total Donors (${activeDonorsCount} Available)</div>
                </div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon red">🚨</div>
                <div>
                    <div class="stat-value">${emergencyCount}</div>
                    <div class="stat-label">Critical Emergencies</div>
                </div>
            </div>
            <div class="glass-card stat-card">
                <div class="stat-icon blue">🏥</div>
                <div>
                    <div class="stat-value">${pendingReqsCount}</div>
                    <div class="stat-label">Active Requests</div>
                </div>
            </div>
        </div>

        <div class="grid-2">
            <div class="glass-card">
                <h3 style="margin-bottom: 16px; font-size: 1.1rem;">Blood Stock Distribution</h3>
                <div class="chart-container">
                    <canvas id="bloodGroupChart"></canvas>
                </div>
            </div>
            <div class="glass-card" style="overflow-x: auto;">
                <h3 style="margin-bottom: 16px; font-size: 1.1rem;">Recent Users</h3>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-table">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    renderBloodGroupChart(allUsers);
    renderUsersTable(allUsers);
}

function renderBloodGroupChart(users) {
    const canvas = document.getElementById('bloodGroupChart');
    if (!canvas || !window.Chart) return;

    const donors = users.filter(u => u.role === 'donor');
    const groupCounts = { "O+":0, "O-":0, "A+":0, "A-":0, "B+":0, "B-":0, "AB+":0, "AB-":0 };
    
    donors.forEach(d => {
        if (groupCounts[d.bloodGroup] !== undefined) {
            groupCounts[d.bloodGroup]++;
        }
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(groupCounts),
            datasets: [{
                data: Object.values(groupCounts),
                backgroundColor: [
                    '#ef4444', '#f87171', '#3b82f6', '#60a5fa', 
                    '#10b981', '#34d399', '#f59e0b', '#fbbf24'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#fff' } }
            }
        }
    });
}

function renderUsersTable(users) {
    const tbody = document.getElementById('admin-users-table');
    if (!tbody) return;

    // Show latest 5 users
    const recentUsers = [...users].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    tbody.innerHTML = recentUsers.map(u => `
        <tr>
            <td>
                <div style="font-weight: 600;">${u.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${u.email}</div>
            </td>
            <td><span class="tag tag-normal">${u.role}</span></td>
            <td>
                ${u.isVerified ? '<span class="verification-badge verified">✓ Verified</span>' : '<span class="verification-badge unverified">Pending</span>'}
            </td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="alert('Verification mock endpoint')">Toggle Verify</button>
            </td>
        </tr>
    `).join('');
}
