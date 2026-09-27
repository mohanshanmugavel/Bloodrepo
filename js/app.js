/* ==========================================================================
   Main Application Controller & Router
   Handles Tab Switching, Demo Simulator, and Initialization
   ========================================================================== */

import { initAuth, getCurrentUser, setCurrentUserSession, onAuthChanged, loginWithGoogle, logoutUser, updateUserProfile } from './auth.js';
import { localDb } from './firebase-config.js';
import { renderDonorStatusCard } from './donor.js';
import { initMap, renderMapData } from './map.js';
import { renderAdminDashboard } from './admin.js';
import { subscribeToNotifications, showToast } from './notifications.js';
import { createBloodRequest, acceptBloodRequestByDonor } from './requester.js';

const indiaStates = {
    "Andaman and Nicobar Islands": ["Andaman", "Nicobar"],
    "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
    "Arunachal Pradesh": ["Itanagar", "Tawang", "Ziro"],
    "Assam": ["Dibrugarh", "Guwahati", "Jorhat", "Nagaon", "Silchar", "Tinsukia"],
    "Bihar": ["Gaya", "Muzaffarpur", "Patna", "Purnia"],
    "Chandigarh": ["Chandigarh"],
    "Chhattisgarh": ["Bhilai", "Bilaspur", "Raipur"],
    "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "South Delhi", "South West Delhi", "West Delhi"],
    "Goa": ["North Goa", "South Goa"],
    "Gujarat": ["Ahmedabad", "Anand", "Bharuch", "Bhavnagar", "Gandhinagar", "Jamnagar", "Rajkot", "Surat", "Vadodara"],
    "Haryana": ["Ambala", "Faridabad", "Gurugram", "Hisar", "Karnal", "Panipat", "Rohtak", "Sonipat"],
    "Himachal Pradesh": ["Dharamshala", "Manali", "Shimla"],
    "Jharkhand": ["Bokaro", "Dhanbad", "Jamshedpur", "Ranchi"],
    "Karnataka": ["Bagalkot", "Bangalore Urban", "Bangalore Rural", "Belagavi", "Bellary", "Bidar", "Chamarajanagar", "Chikballapur", "Chikkamagaluru", "Dakshina Kannada", "Davanagere", "Dharwad", "Hassan", "Haveri", "Hubli", "Kolar", "Koppal", "Mandya", "Mysore", "Raichur", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura"],
    "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kochi", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
    "Madhya Pradesh": ["Bhopal", "Gwalior", "Indore", "Jabalpur", "Rewa", "Sagar", "Ujjain"],
    "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Buldhana", "Dhule", "Jalgaon", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nashik", "Nanded", "Osmanabad", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Solapur", "Thane", "Wardha", "Yavatmal"],
    "Manipur": ["Imphal East", "Imphal West"],
    "Meghalaya": ["East Khasi Hills", "Shillong"],
    "Mizoram": ["Aizawl"],
    "Nagaland": ["Dimapur", "Kohima"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Puri", "Rourkela", "Sambalpur"],
    "Puducherry": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
    "Punjab": ["Amritsar", "Bathinda", "Jalandhar", "Ludhiana", "Pathankot", "Patiala"],
    "Rajasthan": ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur"],
    "Sikkim": ["East Sikkim", "Gangtok"],
    "Tamil Nadu": ["Ariyalur", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kancheepuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Salem", "Sivaganga", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
    "Telangana": ["Hyderabad", "Karimnagar", "Khammam", "Mahabubnagar", "Nalgonda", "Nizamabad", "Ranga Reddy", "Warangal"],
    "Tripura": ["Agartala"],
    "Uttar Pradesh": ["Agra", "Aligarh", "Allahabad", "Bareilly", "Ghaziabad", "Gorakhpur", "Kanpur", "Lucknow", "Mathura", "Meerut", "Noida", "Varanasi"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Nainital", "Rishikesh"],
    "West Bengal": ["Asansol", "Bardhaman", "Darjeeling", "Durgapur", "Hooghly", "Howrah", "Kolkata", "Malda", "Murshidabad", "Siliguri"]
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupTabNavigation();
    setupDemoSimulator();
    
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                const res = await loginWithGoogle();
                if (res.success) {
                    if (res.pendingOnboarding) {
                        if (typeof window.showToast === 'function') {
                            showToast("Almost there!", "Please complete your profile to continue.", "info");
                        }
                    } else {
                        if (typeof window.showToast === 'function') {
                            showToast("Login Success", `Welcome back, ${res.user.name}`, "success");
                        }
                    }
                } else {
                    alert("Login failed: " + res.message);
                }
            } catch (err) {
                alert("An unexpected error occurred: " + err.message);
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await logoutUser();
            showToast("Logged out", "You have been successfully logged out.", "info");
            document.querySelector('[data-target=view-home]').click();
        });
    }

    // Initial Render
    const initialUser = getCurrentUser();
    updateUIPerRole(initialUser);
    if (initialUser) {
        setupNotificationListener();
        syncUserToLocalDb(initialUser);
    }

    onAuthChanged((newUser) => {
        updateUIPerRole(newUser);
        if (newUser) {
            setupNotificationListener();
            // Sync Firebase user to localStorage so they appear in donor search
            syncUserToLocalDb(newUser);
            renderDashboardRequests();
        } else {
            renderDashboardRequests();
        }
    });

    // Subscribe to DB changes for real-time updates
    localDb.subscribe(() => {
        if (document.getElementById('view-home').classList.contains('active')) {
            renderDashboardRequests();
        }
        if (document.getElementById('view-map')?.classList.contains('active')) {
            renderMapData();
        }
        if (document.getElementById('view-dashboard').classList.contains('active')) {
            renderFullDashboard();
        }
    });

    setupCreateRequestForm();
    populateStates();
    setupNotifDropdown();
    
    // Expose for inline onclick
    window.renderDashboardRequests = renderDashboardRequests;

    // Global accept handler for request cards
    window.acceptRequestFromDash = async (requestId) => {
        const currentU = getCurrentUser();
        if (!currentU || currentU.role !== 'donor') {
            showToast('Donors only', 'Only registered donors can accept requests.', 'info');
            return;
        }
        const res = await acceptBloodRequestByDonor(requestId);
        if (res.success) {
            renderDashboardRequests();
            if (document.getElementById('view-dashboard').classList.contains('active')) renderFullDashboard();
        } else {
            showToast('Error', res.message || 'Could not accept request.', 'info');
        }
    };

    window.rejectRequest = async (requestId) => {
        const { rejectBloodRequest } = await import('./requester.js');
        await rejectBloodRequest(requestId);
        showToast('Noted', 'You declined this request. The requester has been notified.', 'info');
    };

    // Initial home render
    renderDashboardRequests();
});

function syncUserToLocalDb(user) {
    if (!user) return;
    const allUsers = localDb.getUsers();
    const idx = allUsers.findIndex(u => u.uid === user.uid);
    if (idx === -1) {
        allUsers.push(user);
    } else {
        allUsers[idx] = { ...allUsers[idx], ...user };
    }
    localDb.saveUsers(allUsers);
}

function setupNotifDropdown() {
    const notifBtn = document.getElementById('notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    if (!notifBtn || !dropdown) return;

    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== 'none';
        dropdown.style.display = isOpen ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!notifBtn.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function populateStates() {
    // Populate both filter dropdowns and request form dropdowns
    const selectors = [
        { state: 'filter-state', dist: 'filter-district', onChange: renderDashboardRequests },
        { state: 'req-state', dist: 'req-district', onChange: updateMatchingDonors },
        { state: 'onboard-state', dist: 'onboard-district', onChange: null }
    ];

    selectors.forEach(({ state: stateId, dist: distId, onChange }) => {
        const stateSelect = document.getElementById(stateId);
        const distSelect = document.getElementById(distId);
        if (!stateSelect) return;

        stateSelect.innerHTML = stateId === 'filter-state'
            ? `<option value="">All States</option>`
            : `<option value="">Select State</option>`;
        Object.keys(indiaStates).sort().forEach(state => {
            stateSelect.innerHTML += `<option value="${state}">${state}</option>`;
        });

        stateSelect.addEventListener('change', (e) => {
            const selectedState = e.target.value;
            if (!distSelect) return;
            distSelect.innerHTML = distId === 'filter-district'
                ? `<option value="">All Districts</option>`
                : `<option value="">Select District</option>`;
            if (selectedState && indiaStates[selectedState]) {
                indiaStates[selectedState].forEach(dist => {
                    distSelect.innerHTML += `<option value="${dist}">${dist}</option>`;
                });
            }
            if (onChange) onChange();
        });

        if (distSelect) {
            distSelect.addEventListener('change', () => {
                if (onChange) onChange();
            });
        }
    });
}

function setupCreateRequestForm() {
    const form = document.getElementById('create-request-form');
    if (!form) return;

    // Live matching donors update when blood group or location changes
    ['req-blood-group', 'req-state', 'req-district'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', updateMatchingDonors);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) return alert('Please log in first.');

        // Get selected donor UIDs from checkboxes
        const selectedDonors = [...document.querySelectorAll('.donor-select-cb:checked')].map(cb => cb.value);

        const district = document.getElementById('req-district')?.value || '';
        const area = document.getElementById('req-area')?.value || '';
        const formData = {
            patientName: document.getElementById('req-patient-name').value,
            bloodGroup: document.getElementById('req-blood-group').value,
            contactPhone: document.getElementById('req-mobile').value,
            contactEmail: document.getElementById('req-email').value,
            hospitalName: document.getElementById('req-hospital').value,
            note: document.getElementById('req-purpose').value,
            emergencyLevel: document.getElementById('req-urgency').value,
            unitsRequired: document.getElementById('req-units').value,
            requiredDate: new Date().toISOString(),
            city: district,
            address: area || district,
            state: document.getElementById('req-state')?.value || '',
            selectedDonorIds: selectedDonors,
            latitude: 9.9252,
            longitude: 78.1198
        };

        if (!formData.city) return alert('Please select a state and district.');

        const res = await createBloodRequest(formData);
        if (res.success) {
            form.reset();
            document.getElementById('matching-donors-list').innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;">Select blood group and location above to see matching donors.</p>';
            showToast('Request Sent!', `Notified ${res.notifiedCount} matching donors.`, 'success');
            document.querySelector('[data-target=view-home]').click();
        } else {
            alert(res.message);
        }
    });
}

function updateMatchingDonors() {
    const container = document.getElementById('matching-donors-list');
    if (!container) return;

    const bloodGroup = document.getElementById('req-blood-group')?.value || '';
    const district = document.getElementById('req-district')?.value || '';

    // Get all donors from localStorage + current session user
    let allDonors = localDb.getUsers().filter(u => u.role === 'donor' && u.isAvailable);

    // Always include current user if they are a donor (Firebase users may not be in localStorage)
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role === 'donor' && currentUser.isAvailable) {
        if (!allDonors.find(d => d.uid === currentUser.uid)) {
            allDonors.push(currentUser);
        }
    }

    let matched = allDonors;
    if (bloodGroup) matched = matched.filter(d => d.bloodGroup === bloodGroup);
    if (district) matched = matched.filter(d => d.city && d.city.toLowerCase() === district.toLowerCase());

    if (matched.length === 0) {
        container.innerHTML = `<div style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;color:#94a3b8;font-size:0.85rem;">No available donors found for selected criteria. The request will still be broadcast to all matching donors.</div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
            <p style="font-size:0.82rem;color:#64748b;margin-bottom:4px;">Select specific donors to notify, or leave all checked to broadcast to everyone matching:</p>
            ${matched.map(d => `
                <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:10px;cursor:pointer;background:#fff;transition:all 0.2s;" onmouseover="this.style.borderColor='#c1121f'" onmouseout="this.style.borderColor='#e2e8f0'">
                    <input type="checkbox" class="donor-select-cb" value="${d.uid}" checked style="width:18px;height:18px;accent-color:#c1121f;">
                    <div class="blood-badge sm" style="flex-shrink:0;">${d.bloodGroup}</div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:0.9rem;">${d.name}</div>
                        <div style="font-size:0.78rem;color:#64748b;">${d.city || ''} ${d.address ? '• ' + d.address : ''}</div>
                    </div>
                    <span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700;">Available</span>
                </label>`).join('')}
        </div>`;
}

function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            const targetRoles = item.getAttribute('data-roles');
            
            // Require login for protected tabs
            if (targetRoles && !getCurrentUser()) {
                alert("Please Sign In / Register first to access this feature.");
                document.getElementById('google-login-btn').click();
                return;
            }
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            tabViews.forEach(view => {
                if (view.id === targetId) {
                    view.classList.add('active');
                } else {
                    view.classList.remove('active');
                }
            });

            // Special handling for map tab to fix leaflet sizing issue
            if (targetId === 'view-map') {
                setTimeout(() => {
                    initMap();
                    renderMapData();
                }, 100);
            }
            
            // Special handling for create request tab — populate matching donors
            if (targetId === 'view-create-request') {
                setTimeout(() => updateMatchingDonors(), 100);
            }

            // Render specific tab content
            if (targetId === 'view-dashboard') {
                renderFullDashboard();
            } else if (targetId === 'view-home') {
                renderDashboardRequests();
            } else if (targetId === 'view-admin') {
                renderAdminDashboard('admin-dashboard-container');
            }
        });
    });

    // Setup Location Filters event listeners
    const filters = ['filter-blood', 'filter-country', 'filter-state', 'filter-district', 'filter-area'];
    filters.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(id === 'filter-area' ? 'input' : 'change', renderDashboardRequests);
        }
    });
}

function renderDashboardRequests() {
    const grid = document.getElementById('requests-grid');
    if (!grid) return;

    const bloodFilter = document.getElementById('filter-blood')?.value || '';
    const stateFilter = document.getElementById('filter-state')?.value || '';
    const districtFilter = document.getElementById('filter-district')?.value || '';
    const areaFilter = document.getElementById('filter-area')?.value?.trim() || '';
    const currentUser = getCurrentUser();

    // Gather all donors — localStorage + current Firebase user
    let allDonors = localDb.getUsers().filter(u => u.role === 'donor' && u.isAvailable);
    if (currentUser && currentUser.role === 'donor' && currentUser.isAvailable) {
        if (!allDonors.find(d => d.uid === currentUser.uid)) allDonors.push(currentUser);
    }

    let allReqs = localDb.getRequests().filter(r => r.status === 'OPEN');

    // Apply blood filter
    if (bloodFilter) {
        allDonors = allDonors.filter(u => u.bloodGroup === bloodFilter);
        allReqs = allReqs.filter(r => r.bloodGroup === bloodFilter);
    }
    // Apply state filter
    if (stateFilter) {
        allDonors = allDonors.filter(u => u.state && u.state.toLowerCase() === stateFilter.toLowerCase());
        allReqs = allReqs.filter(r => r.state && r.state.toLowerCase() === stateFilter.toLowerCase());
    }
    // Apply district filter
    if (districtFilter) {
        allDonors = allDonors.filter(u => u.city && u.city.toLowerCase() === districtFilter.toLowerCase());
        allReqs = allReqs.filter(r => r.city && r.city.toLowerCase() === districtFilter.toLowerCase());
    }
    // Apply area filter
    if (areaFilter) {
        allDonors = allDonors.filter(u => u.address && u.address.toLowerCase().includes(areaFilter.toLowerCase()));
        allReqs = allReqs.filter(r => r.address && r.address.toLowerCase().includes(areaFilter.toLowerCase()));
    }

    let html = '';

    // Donor cards
    if (allDonors.length > 0) {
        html += allDonors.map(donor => {
            const isMe = currentUser && donor.uid === currentUser.uid;
            return `
            <div class="glass-card card-item" style="border-left:4px solid #10b981;position:relative;">
                ${isMe ? '<div style="position:absolute;top:10px;right:12px;font-size:0.7rem;background:#10b981;color:white;padding:2px 8px;border-radius:20px;font-weight:700;">You</div>' : ''}
                <div class="card-header">
                    <div>
                        <div style="background:rgba(16,185,129,0.1);color:#10b981;font-size:0.75rem;font-weight:700;padding:2px 10px;border-radius:20px;margin-bottom:8px;display:inline-block;">🟢 Available Donor</div>
                        <h3 class="card-title" style="margin:0;">${donor.name}</h3>
                    </div>
                    <div class="blood-badge sm">${donor.bloodGroup}</div>
                </div>
                <div class="card-meta" style="margin-top:10px;">
                    <div class="meta-row"><i class="fas fa-map-marker-alt"></i> ${[donor.city, donor.state].filter(Boolean).join(', ')}${donor.address && donor.address !== donor.city ? ' • ' + donor.address : ''}</div>
                    ${donor.phone ? `<div class="meta-row"><i class="fas fa-phone"></i> ${donor.phone}</div>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    // Request cards
    if (allReqs.length > 0) {
        html += allReqs.map(req => {
            const isCritical = req.emergencyLevel === 'CRITICAL';
            const isUrgent = req.emergencyLevel === 'URGENT';
            const borderColor = isCritical ? '#ef4444' : isUrgent ? '#f59e0b' : '#c1121f';
            const showAccept = currentUser && currentUser.role === 'donor' && !req.acceptedDonorId;
            return `
            <div class="glass-card card-item" style="border-left:4px solid ${borderColor};">
                <div class="card-header">
                    <div>
                        <div style="background:${isCritical ? 'rgba(239,68,68,0.1)' : 'rgba(193,18,31,0.1)'};color:${borderColor};font-size:0.75rem;font-weight:700;padding:2px 10px;border-radius:20px;margin-bottom:8px;display:inline-block;">
                            ${isCritical ? '🚨 Critical Emergency' : isUrgent ? '⚡ Urgent' : '🩸 Need Blood'}
                        </div>
                        <h3 class="card-title" style="margin:0;">${req.bloodGroup} — ${req.patientName || 'Patient'}</h3>
                    </div>
                    <div class="blood-badge sm">${req.bloodGroup}</div>
                </div>
                <div class="card-meta" style="margin-top:10px;">
                    <div class="meta-row"><i class="fas fa-hospital"></i> ${req.hospitalName}</div>
                    <div class="meta-row"><i class="fas fa-map-marker-alt"></i> ${[req.city, req.state].filter(Boolean).join(', ')}${req.address && req.address !== req.city ? ' • ' + req.address : ''}</div>
                    <div class="meta-row"><i class="fas fa-tint"></i> ${req.unitsRequired} unit(s) needed</div>
                    <div class="meta-row"><i class="far fa-clock"></i> ${new Date(req.createdAt).toLocaleString()}</div>
                    ${req.note ? `<div class="meta-row"><i class="fas fa-notes-medical"></i> ${req.note}</div>` : ''}
                </div>
                ${req.acceptedDonorId ? `<div style="margin-top:12px;padding:10px;background:rgba(16,185,129,0.08);border-radius:8px;font-size:0.82rem;color:#10b981;font-weight:600;">✅ Donor ${req.acceptedDonorName} has accepted this request</div>` : ''}
                ${showAccept ? `
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <button class="btn btn-success" style="flex:1;" onclick="window.acceptRequestFromDash('${req.requestId}')">✅ Accept & Donate</button>
                </div>` : ''}
            </div>`;
        }).join('');
    }

    if (!html) {
        html = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
            <div style="font-size:3rem;margin-bottom:16px;">🔍</div>
            <p style="color:#94a3b8;font-size:1rem;">No donors or active requests found matching your search.</p>
            <p style="color:#cbd5e1;font-size:0.85rem;margin-top:8px;">Try a different blood group, state, or district.</p>
        </div>`;
    }

    grid.innerHTML = html;
}

function updateUIPerRole(user) {
    const profileBtn = document.getElementById('user-profile-display');
    const notifBtn = document.getElementById('notif-btn');
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const homeCta = document.getElementById('home-cta-container');

    const navItems = document.querySelectorAll('.nav-item');

    if (!user) {
        if (profileBtn) profileBtn.style.display = 'none';
        if (notifBtn) notifBtn.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        if (homeCta) {
            homeCta.innerHTML = `
                <button id="home-cta-login-btn" class="btn btn-primary" style="border-radius: 30px; padding: 14px 32px; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(230,57,70,0.3);">
                    Login / Register to Continue <i class="fas fa-arrow-right"></i>
                </button>
            `;
            setTimeout(() => {
                document.getElementById('home-cta-login-btn')?.addEventListener('click', async () => {
                    document.getElementById('google-login-btn').click();
                });
            }, 100);
        }

        // Show all tabs so the UI looks complete (per user request)
        navItems.forEach(nav => {
            nav.style.display = 'flex';
        });
        return;
    }

    if (profileBtn) {
        profileBtn.style.display = 'flex';
        profileBtn.innerHTML = `
            <div class="avatar">${user.name.charAt(0)}</div>
            <span>${user.name.split(' ')[0]}</span>
        `;
    }
    
    if (notifBtn) notifBtn.style.display = 'flex';
    if (googleBtn) googleBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'flex';

    if (homeCta) {
        homeCta.innerHTML = `
            <button class="btn btn-success" style="border-radius: 30px; padding: 14px 32px; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);" onclick="document.querySelector('[data-target=view-dashboard]').click()">
                Go to Dashboard <i class="fas fa-chart-line"></i>
            </button>
        `;
    }

    // Role specific tab visibility (Admins only see admin tab, etc)
    navItems.forEach(nav => {
        const roles = nav.getAttribute('data-roles');
        if (roles && !roles.includes(user.role)) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }
    });
}

function setupNotificationListener() {
    subscribeToNotifications((notifs) => {
        const unreadCount = notifs.filter(n => !n.isRead).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            badge.innerText = unreadCount;
        }

        // Populate dropdown
        const list = document.getElementById('notif-list');
        if (!list) return;
        if (notifs.length === 0) {
            list.innerHTML = '<div style="font-size:0.9rem;color:#64748b;text-align:center;padding:10px;">No notifications yet.</div>';
            return;
        }
        const currentUser = getCurrentUser();
        const isDonor = currentUser && currentUser.role === 'donor';
        list.innerHTML = notifs.slice(0, 12).map(n => {
            const icon = n.type === 'EMERGENCY_REQUEST' ? '🚨' : n.type === 'ACCEPTED' ? '✅' : n.type === 'COMPLETED' ? '🎉' : n.type === 'REJECTED' ? '❌' : '🔔';
            const bgColor = !n.isRead ? 'rgba(193,18,31,0.05)' : 'transparent';
            const showActions = isDonor && (n.type === 'NEW_REQUEST' || n.type === 'EMERGENCY_REQUEST') && n.requestId;
            return `
                <div style="padding:10px 12px;border-radius:8px;background:${bgColor};border-bottom:1px solid #f1f5f9;">
                    <div style="font-weight:700;font-size:0.88rem;">${icon} ${n.title}</div>
                    <div style="font-size:0.8rem;color:#64748b;margin-top:3px;line-height:1.4;">${n.message}</div>
                    <div style="font-size:0.72rem;color:#94a3b8;margin-top:4px;">${new Date(n.createdAt).toLocaleString()}</div>
                    ${showActions ? `
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <button onclick="window.acceptRequestFromDash('${n.requestId}');document.getElementById('notif-dropdown').style.display='none';"
                            style="flex:1;padding:6px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:700;">✅ Accept</button>
                        <button onclick="window.rejectRequest('${n.requestId}');document.getElementById('notif-dropdown').style.display='none';"
                            style="flex:1;padding:6px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:700;">❌ Reject</button>
                    </div>` : ''}
                </div>`;
        }).join('');
    });
}


function renderFullDashboard() {
    const user = getCurrentUser();
    if (!user) return;

    const isDonor = user.role === 'donor';
    const allDonations = localDb.getDonations();
    const myDonations = allDonations.filter(d => d.donorUid === user.uid);
    const totalUnits = myDonations.reduce((s, d) => s + (parseInt(d.units) || 1), 0);
    const allRequests = localDb.getRequests();
    const myRequests = allRequests.filter(r => r.requesterId === user.uid);
    const statusColor = isDonor && user.isAvailable ? '#10b981' : (isDonor ? '#64748b' : '#3b82f6');
    const eligDays = isDonor && user.lastDonationDate
        ? Math.max(0, 90 - Math.floor((Date.now() - new Date(user.lastDonationDate)) / 86400000))
        : 0;
    const isEligible = isDonor ? eligDays === 0 : false;

    // --- Profile Card ---
    const statusContainer = document.getElementById('donor-status-container');
    if (statusContainer) {
        statusContainer.innerHTML = `
        <div class="glass-card" style="border-left:6px solid ${statusColor};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
                <div style="display:flex;align-items:center;gap:16px;">
                    <div class="blood-badge lg">${user.bloodGroup || '?'}</div>
                    <div>
                        <h3 style="font-size:1.3rem;margin-bottom:4px;">Hello, ${user.name} 👋</h3>
                        <p style="font-size:0.85rem;color:var(--text-muted);">
                            📍 ${user.city || 'N/A'}, ${user.address || 'N/A'} &nbsp;|&nbsp; 📞 ${user.phone || 'N/A'}
                        </p>
                        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">✉️ ${user.email || 'N/A'}</p>
                        <span style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;
                            background:${isDonor ? 'rgba(193,18,31,0.1)' : 'rgba(59,130,246,0.1)'};
                            color:${isDonor ? '#c1121f' : '#3b82f6'}">
                            ${isDonor ? '🩸 Blood Donor' : '👤 Requester'}
                        </span>
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-secondary" id="edit-profile-btn" style="padding:8px 18px;font-size:0.85rem;">✏️ Edit Profile</button>
                    ${!isDonor ? '<button class="btn btn-primary" id="become-donor-btn" style="padding:8px 18px;font-size:0.85rem;">🩸 Become a Donor</button>' : ''}
                    ${isDonor ? `
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <span style="font-size:0.85rem;font-weight:600;color:${user.isAvailable ? '#10b981' : '#64748b'}">
                            ${user.isAvailable ? '🟢 Available' : '🔴 Unavailable'}
                        </span>
                        <div class="switch">
                            <input type="checkbox" id="donor-avail-toggle" ${user.isAvailable ? 'checked' : ''}>
                            <span class="slider"></span>
                        </div>
                    </label>
                    <button class="btn btn-secondary" id="leave-donor-btn" style="padding:6px 14px;font-size:0.8rem;border:1px solid #ef4444;color:#ef4444;background:transparent;">🚪 Leave Donor List</button>` : ''}
                </div>
            </div>
            ${isDonor ? `
            <div style="margin-top:16px;padding:12px;background:rgba(193,18,31,0.04);border-radius:8px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.2rem;">${isEligible ? '✅' : '⏳'}</span>
                <div>
                    <div style="font-size:0.9rem;font-weight:600;">${isEligible ? 'You are eligible to donate today!' : `Cooldown active — ${eligDays} days remaining`}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">Last donation: ${user.lastDonationDate || 'Not recorded'} &nbsp;(90-day safe interval)</div>
                </div>
                <button class="btn btn-sm btn-secondary" id="log-donation-btn" style="margin-left:auto;">📅 Log Donation</button>
            </div>` : ''}
        </div>`;

        // Wire up toggle
        const toggle = statusContainer.querySelector('#donor-avail-toggle');
        if (toggle) {
            toggle.addEventListener('change', async (e) => {
                await updateUserProfile({ isAvailable: e.target.checked });
                renderFullDashboard();
            });
        }

        // Edit profile
        statusContainer.querySelector('#edit-profile-btn')?.addEventListener('click', () => {
            showEditProfileModal(user);
        });

        // Become donor
        statusContainer.querySelector('#become-donor-btn')?.addEventListener('click', () => {
            showBecomeDonorModal(user);
        });

        // Leave donor list
        statusContainer.querySelector('#leave-donor-btn')?.addEventListener('click', async () => {
            if (confirm('Are you sure you want to leave the donor list? You can re-join anytime.')) {
                await updateUserProfile({ role: 'requester', isAvailable: false });
                showToast('Removed from donor list', 'You have been removed from the donor list.', 'info');
                renderFullDashboard();
            }
        });

        // Log donation date
        statusContainer.querySelector('#log-donation-btn')?.addEventListener('click', () => {
            const d = prompt('Enter last donation date (YYYY-MM-DD):');
            if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
                updateUserProfile({ lastDonationDate: d }).then(() => renderFullDashboard());
            } else if (d) {
                alert('Please enter date in YYYY-MM-DD format');
            }
        });
    }

    // --- Stats Row ---
    const statsEl = document.getElementById('dashboard-stats');
    if (statsEl) {
        const stats = isDonor
            ? [
                { icon: '🩸', label: 'Total Units Donated', value: totalUnits, color: '#c1121f' },
                { icon: '🏆', label: 'Donations Made', value: myDonations.length, color: '#c1121f' },
                { icon: user.isAvailable ? '🟢' : '🔴', label: 'Status', value: user.isAvailable ? 'Available' : 'Unavailable', color: user.isAvailable ? '#10b981' : '#64748b' },
                { icon: '📅', label: 'Last Donation', value: user.lastDonationDate || 'Never', color: '#3b82f6' },
            ]
            : [
                { icon: '📋', label: 'Total Requests', value: myRequests.length, color: '#3b82f6' },
                { icon: '🔓', label: 'Open Requests', value: myRequests.filter(r => r.status === 'OPEN').length, color: '#f59e0b' },
                { icon: '✅', label: 'Fulfilled', value: myRequests.filter(r => r.status === 'COMPLETED').length, color: '#10b981' },
                { icon: '🤝', label: 'Accepted', value: myRequests.filter(r => r.status === 'ACCEPTED').length, color: '#c1121f' },
            ];
        statsEl.innerHTML = stats.map(s => `
            <div class="glass-card" style="text-align:center;padding:24px 16px;">
                <div style="font-size:2rem;margin-bottom:8px;">${s.icon}</div>
                <div style="font-size:1.8rem;font-weight:900;color:${s.color};">${s.value}</div>
                <div style="font-size:0.82rem;color:var(--text-muted);margin-top:4px;">${s.label}</div>
            </div>`).join('');
    }

    // --- History ---
    const histEl = document.getElementById('dashboard-history');
    if (histEl) {
        if (isDonor) {
            histEl.innerHTML = `
                <h3 style="font-size:1.2rem;margin-bottom:16px;">🩸 My Donation History</h3>
                ${myDonations.length === 0
                    ? '<div class="glass-card" style="text-align:center;color:var(--text-muted);padding:30px;">No donations recorded yet. Accept a blood request to get started!</div>'
                    : `<div style="display:flex;flex-direction:column;gap:12px;">${myDonations.map(d => `
                        <div class="glass-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:16px 20px;">
                            <div>
                                <div style="font-weight:700;font-size:0.95rem;">🏥 ${d.hospitalName}</div>
                                <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px;">Patient: ${d.requesterName || 'Unknown'} &nbsp;|&nbsp; ${new Date(d.completedAt).toLocaleDateString()}</div>
                            </div>
                            <div class="blood-badge sm">${d.bloodGroup}</div>
                        </div>`).join('')}</div>`
                }`;
        } else {
            histEl.innerHTML = `
                <h3 style="font-size:1.2rem;margin-bottom:16px;">📋 My Blood Requests</h3>
                ${myRequests.length === 0
                    ? '<div class="glass-card" style="text-align:center;color:var(--text-muted);padding:30px;">No blood requests yet. Use the "Request Blood" tab to create one.</div>'
                    : `<div style="display:flex;flex-direction:column;gap:12px;">${myRequests.map(r => {
                        const statusColors = { OPEN:'#f59e0b', ACCEPTED:'#3b82f6', COMPLETED:'#10b981', CLOSED:'#64748b' };
                        const sc = statusColors[r.status] || '#64748b';
                        return `
                        <div class="glass-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:16px 20px;">
                            <div>
                                <div style="font-weight:700;font-size:0.95rem;">${r.bloodGroup} — ${r.hospitalName}</div>
                                <div style="font-size:0.82rem;color:var(--text-muted);margin-top:3px;">Patient: ${r.patientName} &nbsp;|&nbsp; ${new Date(r.createdAt).toLocaleDateString()}</div>
                                ${r.acceptedDonorName ? `<div style="font-size:0.82rem;color:#10b981;margin-top:3px;">✅ Donor: ${r.acceptedDonorName} (${r.acceptedDonorPhone || ''})</div>` : ''}
                            </div>
                            <span style="padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:700;background:rgba(0,0,0,0.05);color:${sc};">${r.status}</span>
                        </div>`;
                    }).join('')}</div>`
                }`;
        }
    }
}

function setupDemoSimulator() {
    // Quick Demo Login switches
    const btnArun = document.getElementById('demo-arun');
    const btnPriya = document.getElementById('demo-priya');
    const btnAdmin = document.getElementById('demo-admin');

    const users = localDb.getUsers();

    if (btnArun) btnArun.addEventListener('click', () => {
        setCurrentUserSession(users.find(u => u.uid === 'usr_donor_1'));
        showToast("Demo Switched", "Logged in as Arun (Donor)");
    });
    
    if (btnPriya) btnPriya.addEventListener('click', () => {
        setCurrentUserSession(users.find(u => u.uid === 'usr_requester_1'));
        showToast("Demo Switched", "Logged in as Lakshmi (Requester)");
    });
    
    if (btnAdmin) btnAdmin.addEventListener('click', () => {
        setCurrentUserSession(users.find(u => u.uid === 'usr_admin_1'));
        showToast("Demo Switched", "Logged in as Admin");
    });
}

function showEditProfileModal(user) {
    // Remove old modal if any
    document.getElementById('edit-profile-modal')?.remove();

    // Build state options
    const stateOptions = Object.keys(indiaStates).sort().map(s =>
        `<option value="${s}" ${user.state === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    const initDists = user.state && indiaStates[user.state]
        ? indiaStates[user.state].map(d => `<option value="${d}" ${user.city === d ? 'selected' : ''}>${d}</option>`).join('')
        : (user.city ? `<option value="${user.city}" selected>${user.city}</option>` : '');

    const modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex;z-index:9999;';
    modal.innerHTML = `
        <div class="glass-card modal-content" style="max-width:500px;width:90%;">
            <h2 style="margin-bottom:6px;">✏️ Edit Profile</h2>
            <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Update your personal details.</p>
            <form id="edit-profile-form">
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Phone Number</label>
                        <input type="tel" id="ep-phone" class="form-control" value="${user.phone || ''}" placeholder="+91...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Blood Group</label>
                        <select id="ep-blood" class="form-control">
                            ${['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(bg =>
                                `<option value="${bg}" ${user.bloodGroup === bg ? 'selected' : ''}>${bg}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">State</label>
                        <select id="ep-state" class="form-control">
                            <option value="">Select State</option>
                            ${stateOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">District / City</label>
                        <select id="ep-district" class="form-control">
                            <option value="">Select District</option>
                            ${initDists}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Local Area</label>
                    <input type="text" id="ep-area" class="form-control" value="${user.address || ''}" placeholder="e.g. Anna Nagar">
                </div>
                <div class="form-group">
                    <label class="form-label">Age</label>
                    <input type="number" id="ep-age" class="form-control" value="${user.age || ''}" placeholder="e.g. 25" min="18" max="65">
                </div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">Save Changes</button>
                    <button type="button" class="btn btn-secondary" id="ep-cancel" style="flex:1;">Cancel</button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(modal);

    // Wire state → district cascade
    modal.querySelector('#ep-state').addEventListener('change', (e) => {
        const distSel = modal.querySelector('#ep-district');
        const dists = indiaStates[e.target.value] || [];
        distSel.innerHTML = `<option value="">Select District</option>` +
            dists.map(d => `<option value="${d}">${d}</option>`).join('');
    });

    modal.querySelector('#ep-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#edit-profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const state = modal.querySelector('#ep-state').value;
        const district = modal.querySelector('#ep-district').value;
        const updates = {
            phone: modal.querySelector('#ep-phone').value,
            bloodGroup: modal.querySelector('#ep-blood').value,
            state: state || user.state || '',
            city: district || user.city || '',
            address: modal.querySelector('#ep-area').value,
            age: parseInt(modal.querySelector('#ep-age').value) || user.age
        };
        await updateUserProfile(updates);
        syncUserToLocalDb({ ...getCurrentUser(), ...updates });
        modal.remove();
        showToast('Profile Updated', 'Your profile has been saved.', 'success');
        renderFullDashboard();
        renderDashboardRequests();
    });
}

function showBecomeDonorModal(user) {
    document.getElementById('become-donor-modal')?.remove();

    // Build state options
    const stateOptions = Object.keys(indiaStates).sort().map(s =>
        `<option value="${s}" ${user.state === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    // Build district options for current user's state
    const initDists = user.state && indiaStates[user.state]
        ? indiaStates[user.state].map(d => `<option value="${d}" ${user.city === d ? 'selected' : ''}>${d}</option>`).join('')
        : '';

    const modal = document.createElement('div');
    modal.id = 'become-donor-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex;z-index:9999;';
    modal.innerHTML = `
        <div class="glass-card modal-content" style="max-width:480px;width:90%;">
            <h2 style="margin-bottom:6px;color:#c1121f;">🩸 Become a Blood Donor</h2>
            <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Join the donor list and help save lives. You can toggle your availability any time.</p>
            <form id="become-donor-form">
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">Blood Group</label>
                        <select id="bd-blood" class="form-control">
                            ${['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(bg =>
                                `<option value="${bg}" ${user.bloodGroup === bg ? 'selected' : ''}>${bg}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Age</label>
                        <input type="number" id="bd-age" class="form-control" value="${user.age || ''}" placeholder="18–65" min="18" max="65" required>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label class="form-label">State</label>
                        <select id="bd-state" class="form-control" required>
                            <option value="">Select State</option>
                            ${stateOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">District / City</label>
                        <select id="bd-district" class="form-control" required>
                            <option value="">Select District</option>
                            ${initDists}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Local Area</label>
                    <input type="text" id="bd-area" class="form-control" value="${user.address || ''}" placeholder="e.g. Anna Nagar" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Last Donation Date (if any)</label>
                    <input type="date" id="bd-last-donation" class="form-control">
                </div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">Register as Donor</button>
                    <button type="button" id="bd-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(modal);

    // Wire state → district cascade
    modal.querySelector('#bd-state').addEventListener('change', (e) => {
        const distSel = modal.querySelector('#bd-district');
        const dists = indiaStates[e.target.value] || [];
        distSel.innerHTML = `<option value="">Select District</option>` +
            dists.map(d => `<option value="${d}">${d}</option>`).join('');
    });

    modal.querySelector('#bd-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#become-donor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const state = modal.querySelector('#bd-state').value;
        const district = modal.querySelector('#bd-district').value;
        const area = modal.querySelector('#bd-area').value;
        if (!state || !district) {
            alert('Please select a State and District.');
            return;
        }
        const updates = {
            role: 'donor',
            isAvailable: true,
            bloodGroup: modal.querySelector('#bd-blood').value,
            age: parseInt(modal.querySelector('#bd-age').value),
            state: state,
            city: district,
            address: area || district,
            lastDonationDate: modal.querySelector('#bd-last-donation').value || null
        };
        await updateUserProfile(updates);
        // Sync to localStorage so donor appears in search immediately
        syncUserToLocalDb({ ...getCurrentUser(), ...updates });
        modal.remove();
        showToast('Welcome, Donor!', 'You are now registered as a blood donor. 🩸', 'success');
        renderFullDashboard();
        renderDashboardRequests();
    });
}
