/* ==========================================================================
   Lifepluse - Main Application Controller & Router
   Clean, Streamlined Implementation with Real-Time Sync,
   Donors Directory, Recipient Requests, Simple Status Tracker, and Direct Requests
   ========================================================================== */

import { initAuth, getCurrentUser, setCurrentUserSession, onAuthChanged, loginWithGoogle, logoutUser, updateUserProfile } from './auth.js';
import { localDb, db, isRealFirebaseConfigured } from './firebase-config.js';
import { renderDonorStatusCard } from './donor.js';
import { 
    subscribeToNotifications, 
    showToast, 
    markNotificationRead, 
    markAllNotificationsRead, 
    deleteNotification, 
    clearAllNotifications, 
    requestBrowserNotificationPermission 
} from './notifications.js';
import { createBloodRequest, acceptBloodRequestByDonor, createDirectDonorRequest, cancelBloodRequest, reopenBloodRequestAsBroadcast, getMyRequests } from './requester.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

let selectedDirectDonor = null;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupTabNavigation();
    initRealtimeFirestoreSync();
    
    // Google Sign in / Register
    const googleBtn = document.getElementById('google-login-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            try {
                const res = await loginWithGoogle();
                if (res.success) {
                    if (res.pendingOnboarding) {
                        showToast("Almost there!", "Please complete your profile to continue.", "info");
                    } else {
                        showToast("Welcome to Lifepluse", `Logged in as ${res.user.name}`, "success");
                    }
                } else {
                    alert("Login failed: " + res.message);
                }
            } catch (err) {
                alert("An unexpected error occurred: " + err.message);
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await logoutUser();
            showToast("Logged out", "You have been logged out.", "info");
            document.querySelector('[data-target=view-home]').click();
        });
    }

    // Auth state listener
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
            syncUserToLocalDb(newUser);
        }
        renderActiveTab();
    });

    // Reactive subscription to local storage updates
    localDb.subscribe(() => {
        renderActiveTab();
    });

    setupCreateRequestForm();
    setupDirectRequestForm();
    populateAllStateDropdowns();
    setupNotifDropdown();
    setupFilterListeners();

    // Initial Active Renders
    renderDonorsDirectory();
    renderRecipientsDirectory();
});

/* ==========================================================================
   Real-Time Firestore Sync
   ========================================================================== */
function initRealtimeFirestoreSync() {
    if (!isRealFirebaseConfigured) return;

    try {
        onSnapshot(collection(db, "users"), (snapshot) => {
            const userMap = new Map();
            localDb.getUsers().forEach(u => {
                if (u && u.uid) userMap.set(u.uid, u);
            });

            snapshot.forEach(doc => {
                const data = doc.data();
                userMap.set(doc.id, { ...data, uid: doc.id });
            });

            localDb.saveUsers(Array.from(userMap.values()));
        }, (err) => {
            console.warn("Firestore users sync error:", err);
        });

        onSnapshot(collection(db, "bloodRequests"), (snapshot) => {
            const reqMap = new Map();
            localDb.getRequests().forEach(r => {
                if (r && r.requestId) reqMap.set(r.requestId, r);
            });

            snapshot.forEach(doc => {
                const data = doc.data();
                const actualId = data.requestId || doc.id;
                reqMap.set(actualId, { ...data, requestId: actualId });
            });

            localDb.saveRequests(Array.from(reqMap.values()));
        }, (err) => {
            console.warn("Firestore requests sync error:", err);
        });
    } catch (e) {
        console.warn("Sync error:", e);
    }
}

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

/* ==========================================================================
   Tab Navigation & Router
   ========================================================================== */
function setupTabNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            tabViews.forEach(view => {
                if (view.id === targetId) {
                    view.classList.add('active');
                } else {
                    view.classList.remove('active');
                }
            });

            if (targetId === 'view-donors') {
                renderDonorsDirectory();
            } else if (targetId === 'view-requests') {
                renderRecipientsDirectory();
            } else if (targetId === 'view-my-status') {
                renderMyStatusTracker();
            } else if (targetId === 'view-dashboard') {
                renderFullDashboard();
            }
        });
    });
}

function renderActiveTab() {
    if (document.getElementById('view-donors')?.classList.contains('active')) {
        renderDonorsDirectory();
    }
    if (document.getElementById('view-requests')?.classList.contains('active')) {
        renderRecipientsDirectory();
    }
    if (document.getElementById('view-my-status')?.classList.contains('active')) {
        renderMyStatusTracker();
    }
    if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        renderFullDashboard();
    }
}

function setupFilterListeners() {
    ['donor-filter-blood', 'donor-filter-state', 'donor-filter-district', 'donor-filter-area', 'donor-filter-avail'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(id === 'donor-filter-area' ? 'input' : 'change', renderDonorsDirectory);
        }
    });

    ['req-filter-blood', 'req-filter-urgency', 'req-filter-state', 'req-filter-district'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', renderRecipientsDirectory);
        }
    });
}

/* ==========================================================================
   1. DONORS DIRECTORY (All Registered Donors Visible to All)
   ========================================================================== */
export function renderDonorsDirectory() {
    const grid = document.getElementById('donors-directory-grid');
    if (!grid) return;

    const bloodFilter = document.getElementById('donor-filter-blood')?.value || '';
    const stateFilter = document.getElementById('donor-filter-state')?.value || '';
    const districtFilter = document.getElementById('donor-filter-district')?.value || '';
    const areaFilter = document.getElementById('donor-filter-area')?.value?.trim().toLowerCase() || '';
    const availFilter = document.getElementById('donor-filter-avail')?.value || '';

    const currentUser = getCurrentUser();
    let donors = localDb.getUsers().filter(u => u.role === 'donor' && u.status !== 'inactive');

    if (currentUser && currentUser.role === 'donor') {
        if (!donors.find(d => d.uid === currentUser.uid)) {
            donors.push(currentUser);
        }
    }

    if (bloodFilter) donors = donors.filter(d => d.bloodGroup === bloodFilter);
    if (stateFilter) donors = donors.filter(d => d.state && d.state.toLowerCase() === stateFilter.toLowerCase());
    if (districtFilter) donors = donors.filter(d => d.city && d.city.toLowerCase() === districtFilter.toLowerCase());
    if (areaFilter) donors = donors.filter(d => (d.address && d.address.toLowerCase().includes(areaFilter)) || (d.city && d.city.toLowerCase().includes(areaFilter)));
    if (availFilter === 'available') donors = donors.filter(d => d.isAvailable);

    if (donors.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-box">
                <div class="empty-state-icon">🩸</div>
                <h3>No Donors Registered Yet</h3>
                <p>Be the first volunteer hero to register as a donor in your district.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="showBecomeDonorModalFromNav()">Register as Donor</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = donors.map(donor => {
        const isMe = currentUser && donor.uid === currentUser.uid;
        const isAvail = donor.isAvailable;
        const availBadge = isAvail
            ? `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Available</span>`
            : `<span class="badge badge-neutral"><i class="fas fa-clock"></i> On Cooldown</span>`;

        return `
        <div class="glass-card donor-card ${isAvail ? 'available' : 'cooldown'}">
            ${isMe ? '<div class="you-badge">You</div>' : ''}
            <div>
                <div class="donor-card-top">
                    <div>
                        <div style="margin-bottom: 4px;">${availBadge}</div>
                        <h3 class="donor-name">${donor.name}</h3>
                        <div class="donor-sub">Volunteer Donor</div>
                    </div>
                    <div class="blood-badge lg">${donor.bloodGroup || 'O+'}</div>
                </div>

                <div class="donor-meta">
                    <div><i class="fas fa-map-marker-alt text-primary"></i> ${[donor.city, donor.state].filter(Boolean).join(', ')}${donor.address && donor.address !== donor.city ? ' (' + donor.address + ')' : ''}</div>
                    ${donor.phone ? `<div><i class="fas fa-phone-alt text-success"></i> ${donor.phone}</div>` : ''}
                    ${donor.lastDonationDate ? `<div><i class="far fa-calendar-alt text-blue"></i> Last donation: ${donor.lastDonationDate}</div>` : ''}
                </div>
            </div>

            <div class="donor-card-actions">
                <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="window.openDirectRequestModal('${donor.uid}')">
                    <i class="fas fa-paper-plane"></i> Request Blood
                </button>
                ${donor.phone ? `<a href="tel:${donor.phone}" class="btn btn-secondary btn-sm" style="text-decoration: none;"><i class="fas fa-phone"></i> Call</a>` : ''}
            </div>
        </div>`;
    }).join('');
}

/* ==========================================================================
   2. RECIPIENT REQUESTS DIRECTORY
   ========================================================================== */
export function renderRecipientsDirectory() {
    const grid = document.getElementById('recipients-directory-grid');
    if (!grid) return;

    const bloodFilter = document.getElementById('req-filter-blood')?.value || '';
    const urgencyFilter = document.getElementById('req-filter-urgency')?.value || '';
    const stateFilter = document.getElementById('req-filter-state')?.value || '';
    const districtFilter = document.getElementById('req-filter-district')?.value || '';

    const currentUser = getCurrentUser();
    let allReqs = localDb.getRequests().filter(r => r.status === 'OPEN');

    if (bloodFilter) allReqs = allReqs.filter(r => r.bloodGroup === bloodFilter);
    if (urgencyFilter) allReqs = allReqs.filter(r => r.emergencyLevel === urgencyFilter);
    if (stateFilter) allReqs = allReqs.filter(r => r.state && r.state.toLowerCase() === stateFilter.toLowerCase());
    if (districtFilter) allReqs = allReqs.filter(r => r.city && r.city.toLowerCase() === districtFilter.toLowerCase());

    if (allReqs.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-box">
                <div class="empty-state-icon">📋</div>
                <h3>No Active Requests</h3>
                <p>There are no open blood emergency requests at the moment.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="document.querySelector('[data-target=view-create-request]').click()">Create Blood Request</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = allReqs.map(req => {
        const isCritical = req.emergencyLevel === 'CRITICAL';
        const isUrgent = req.emergencyLevel === 'URGENT';
        const isDirect = req.isDirectRequest;
        const urgencyClass = isCritical ? 'badge-danger' : isUrgent ? 'badge-warning' : 'badge-primary';
        const urgencyText = isCritical ? '🚨 Critical Emergency' : isUrgent ? '⚡ Urgent' : '🩸 Normal Need';
        const canAccept = currentUser && currentUser.role === 'donor' && !req.acceptedDonorId;

        return `
        <div class="glass-card request-card ${isCritical ? 'critical' : ''}">
            <div>
                <div class="request-card-top">
                    <div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                            <span class="badge ${urgencyClass}">${urgencyText}</span>
                            ${isDirect ? `<span class="badge badge-blue">Direct for ${req.targetDonorName}</span>` : ''}
                        </div>
                        <h3 class="patient-title">${req.patientName || 'Patient'}</h3>
                        <div class="units-needed">${req.unitsRequired || 1} Unit(s) needed &bull; ${req.hospitalName}</div>
                    </div>
                    <div class="blood-badge lg">${req.bloodGroup}</div>
                </div>

                <div class="request-meta">
                    <div><i class="fas fa-hospital text-primary"></i> <strong>${req.hospitalName}</strong></div>
                    <div><i class="fas fa-map-marker-alt text-muted"></i> ${[req.city, req.state].filter(Boolean).join(', ')}${req.address && req.address !== req.city ? ' (' + req.address + ')' : ''}</div>
                    ${req.note ? `<div><i class="fas fa-notes-medical text-blue"></i> ${req.note}</div>` : ''}
                    <div class="date-text"><i class="far fa-clock"></i> ${new Date(req.createdAt).toLocaleString()}</div>
                </div>
            </div>

            <div class="request-card-actions">
                ${canAccept ? `
                    <button class="btn btn-success btn-block" onclick="window.acceptRequestFromDirectory('${req.requestId}')">
                        <i class="fas fa-check-circle"></i> Accept & Donate Blood
                    </button>
                ` : `
                    <div style="display: flex; gap: 8px; width: 100%;">
                        ${req.contactPhone ? `<a href="tel:${req.contactPhone}" class="btn btn-secondary btn-sm" style="flex: 1; text-decoration: none;"><i class="fas fa-phone"></i> Call Contact</a>` : ''}
                        <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="document.querySelector('[data-target=view-donors]').click()">Find Donors</button>
                    </div>
                `}
            </div>
        </div>`;
    }).join('');
}

window.acceptRequestFromDirectory = async function(requestId) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Login Required', 'Please sign in to accept blood donation requests.', 'info');
        document.getElementById('google-login-btn')?.click();
        return;
    }
    if (user.role !== 'donor') {
        showToast('Donor Profile Required', 'Please complete your donor profile to accept requests.', 'info');
        showBecomeDonorModal(user);
        return;
    }
    const res = await acceptBloodRequestByDonor(requestId);
    if (res.success) {
        renderRecipientsDirectory();
        renderMyStatusTracker();
    }
};

window.rejectRequest = async function(requestId) {
    const { rejectBloodRequest } = await import('./requester.js');
    await rejectBloodRequest(requestId);
    showToast('Request Declined', 'You declined this blood request.', 'info');
};

/* ==========================================================================
   3. TRACK STATUS (COMPREHENSIVE REAL-TIME REQUEST TRACKING)
   ========================================================================== */
export function renderMyStatusTracker() {
    const container = document.getElementById('status-tracker-list');
    if (!container) return;

    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = `
            <div class="glass-card empty-state-box">
                <div class="empty-state-icon">🔒</div>
                <h3>Sign in to Track Requests</h3>
                <p>Sign in with your Google account to view real-time status of your requests.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="document.getElementById('google-login-btn').click()">Sign in</button>
            </div>
        `;
        return;
    }

    const myRequests = getMyRequests();

    if (myRequests.length === 0) {
        container.innerHTML = `
            <div class="glass-card empty-state-box">
                <div class="empty-state-icon">🩸</div>
                <h3>No Requests to Track</h3>
                <p>You haven't submitted any blood requests yet.</p>
                <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="document.querySelector('[data-target=view-create-request]').click()">Create Blood Request</button>
            </div>
        `;
        return;
    }

    container.innerHTML = myRequests.map(req => {
        const isCancelled = req.status === 'CANCELLED';
        const isCompleted = req.status === 'COMPLETED';
        const isAccepted = req.status === 'ACCEPTED';
        const isRejected = req.status === 'REJECTED';
        const isPending = !isCancelled && !isCompleted && !isAccepted && !isRejected;

        let statusPill = '';
        if (isCancelled) {
            statusPill = `<span class="badge badge-neutral"><i class="fas fa-ban"></i> Cancelled</span>`;
        } else if (isCompleted) {
            statusPill = `<span class="badge" style="background:#e0e7ff;color:#4338ca;font-weight:700;padding:5px 12px;border-radius:20px;"><i class="fas fa-check-double"></i> Completed & Fulfilled</span>`;
        } else if (isAccepted) {
            statusPill = `<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700;padding:5px 12px;border-radius:20px;"><i class="fas fa-handshake"></i> Accepted & Donor Matched</span>`;
        } else if (isRejected) {
            statusPill = `<span class="badge" style="background:#fee2e2;color:#b91c1c;font-weight:700;padding:5px 12px;border-radius:20px;"><i class="fas fa-times-circle"></i> Rejected / Declined</span>`;
        } else {
            statusPill = `<span class="badge" style="background:#fef3c7;color:#b45309;font-weight:700;padding:5px 12px;border-radius:20px;"><i class="fas fa-hourglass-half"></i> Pending / Awaiting Donor</span>`;
        }

        return `
        <div class="glass-card simple-status-card" style="border-left: 4px solid ${isAccepted ? '#10b981' : isRejected ? '#ef4444' : isCompleted ? '#6366f1' : isCancelled ? '#94a3b8' : '#f59e0b'};">
            <div class="status-card-header">
                <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
                    <div class="blood-badge lg">${req.bloodGroup}</div>
                    <div>
                        <h3 class="status-patient-name" style="margin-bottom: 3px;">${req.patientName} &bull; ${req.hospitalName}</h3>
                        <p class="status-sub">${[req.city, req.state].filter(Boolean).join(', ')} &bull; ${req.unitsRequired} Unit(s) required &bull; Created ${new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                <div>${statusPill}</div>
            </div>

            ${isAccepted && req.acceptedDonorName ? `
            <div class="matched-donor-box" style="margin-top: 14px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div class="matched-title" style="font-size: 0.75rem; text-transform: uppercase; color: #15803d; font-weight: 700;">✅ Matched Hero Donor</div>
                        <div class="matched-name" style="font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 2px 0;">${req.acceptedDonorName} (${req.bloodGroup})</div>
                        <div class="matched-phone" style="font-size: 0.88rem; color: #334155;">📞 Phone: <strong>${req.acceptedDonorPhone || 'Contact available'}</strong></div>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${req.acceptedDonorPhone ? `<a href="tel:${req.acceptedDonorPhone}" class="btn btn-success btn-sm" style="text-decoration: none;"><i class="fas fa-phone"></i> Call Donor</a>` : ''}
                        ${!isCompleted ? `<button class="btn btn-primary btn-sm" onclick="window.completeRequestFromTracker('${req.requestId}')"><i class="fas fa-check-double"></i> Mark Completed</button>` : ''}
                    </div>
                </div>
            </div>` : ''}

            ${isRejected ? `
            <div style="margin-top: 14px; padding: 14px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; color: #9f1239;">
                <div style="font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-size: 0.92rem;">
                    <i class="fas fa-exclamation-triangle"></i> Request Declined by Donor
                </div>
                <div style="font-size: 0.85rem; line-height: 1.45; color: #881337;">
                    ${req.rejectedByDonorName ? `Donor <strong>${req.rejectedByDonorName}</strong> was unable to accept your blood request.` : `The requested donor was unavailable for this blood requirement.`}
                    You can broadcast this request to all nearby compatible donors across ${req.city || 'your area'} or search for other donors.
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm" onclick="window.reopenRequestAsBroadcast('${req.requestId}')">
                        <i class="fas fa-bullhorn"></i> Broadcast to All Donors
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-target=view-donors]').click()">
                        <i class="fas fa-search"></i> Search Other Donors
                    </button>
                </div>
            </div>` : ''}

            ${isPending ? `
            <div style="margin-top: 12px; padding: 12px 14px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; color: #854d0e; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                    <i class="fas fa-broadcast-tower"></i>
                    ${req.isDirectRequest ? `Direct request sent to <strong>${req.targetDonorName || 'Donor'}</strong>. Awaiting response.` : `Broadcasting to all eligible ${req.bloodGroup} donors in ${req.city || 'your district'}.`}
                </div>
                <button class="btn btn-secondary btn-sm" style="color: #ef4444;" onclick="window.cancelRequestFromTracker('${req.requestId}')">
                    <i class="fas fa-times"></i> Cancel Request
                </button>
            </div>` : ''}
        </div>`;
    }).join('');
}

window.completeRequestFromTracker = async function(requestId) {
    const { markDonationCompleted } = await import('./donor.js');
    const res = await markDonationCompleted(requestId);
    if (res.success) {
        showToast('Donation Completed! 🎉', 'Request recorded as fulfilled.', 'success');
        renderMyStatusTracker();
    }
};

window.cancelRequestFromTracker = async function(requestId) {
    if (confirm("Are you sure you want to cancel this blood request?")) {
        await cancelBloodRequest(requestId);
        renderMyStatusTracker();
    }
};

window.reopenRequestAsBroadcast = async function(requestId) {
    await reopenBloodRequestAsBroadcast(requestId);
    renderMyStatusTracker();
    renderRecipientsDirectory();
};

/* ==========================================================================
   4. DIRECT DONOR REQUEST MODAL
   ========================================================================== */
window.openDirectRequestModal = function(donorUid) {
    const user = getCurrentUser();
    if (!user) {
        showToast('Login Required', 'Please sign in to send a direct blood request.', 'info');
        document.getElementById('google-login-btn')?.click();
        return;
    }

    const allUsers = localDb.getUsers();
    const donor = allUsers.find(u => u.uid === donorUid);
    if (!donor) return alert("Donor not found.");

    selectedDirectDonor = donor;

    const modal = document.getElementById('direct-request-modal');
    const summary = document.getElementById('direct-donor-summary');
    if (!modal || !summary) return;

    summary.innerHTML = `
        <div class="blood-badge lg" style="width: 44px; height: 44px; font-size: 1.1rem; flex-shrink: 0;">${donor.bloodGroup}</div>
        <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">Requesting: ${donor.name}</div>
            <div style="font-size: 0.8rem; color: #64748b;">📍 ${[donor.city, donor.state].filter(Boolean).join(', ')}</div>
        </div>
    `;

    document.getElementById('dr-phone').value = user.phone || '';
    modal.style.display = 'flex';
};

window.closeDirectRequestModal = function() {
    const modal = document.getElementById('direct-request-modal');
    if (modal) modal.style.display = 'none';
    selectedDirectDonor = null;
};

function setupDirectRequestForm() {
    const form = document.getElementById('direct-request-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedDirectDonor) return;

        const formData = {
            patientName: document.getElementById('dr-patient-name').value,
            bloodGroup: selectedDirectDonor.bloodGroup,
            unitsRequired: document.getElementById('dr-units').value,
            hospitalName: document.getElementById('dr-hospital').value,
            contactPhone: document.getElementById('dr-phone').value,
            emergencyLevel: document.getElementById('dr-urgency').value,
            note: document.getElementById('dr-note').value,
            city: selectedDirectDonor.city || '',
            state: selectedDirectDonor.state || ''
        };

        const res = await createDirectDonorRequest(selectedDirectDonor, formData);
        if (res.success) {
            form.reset();
            window.closeDirectRequestModal();
            showToast('Direct Request Sent! 🩸', `Notification sent to ${selectedDirectDonor.name}.`, 'success');
            document.querySelector('[data-target=view-my-status]')?.click();
        } else {
            alert("Failed to send request: " + res.message);
        }
    });
}

/* ==========================================================================
   5. REQUEST FORM
   ========================================================================== */
function setupCreateRequestForm() {
    const form = document.getElementById('create-request-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            showToast('Login Required', 'Please sign in to broadcast blood requests.', 'info');
            document.getElementById('google-login-btn')?.click();
            return;
        }

        const district = document.getElementById('req-district')?.value || '';
        const area = document.getElementById('req-area')?.value || '';

        const formData = {
            patientName: document.getElementById('req-patient-name').value,
            bloodGroup: document.getElementById('req-blood-group').value,
            contactPhone: document.getElementById('req-mobile').value,
            hospitalName: document.getElementById('req-hospital').value,
            note: document.getElementById('req-purpose').value,
            emergencyLevel: document.getElementById('req-urgency').value,
            unitsRequired: document.getElementById('req-units').value,
            requiredDate: new Date().toISOString(),
            city: district,
            address: area || district,
            state: document.getElementById('req-state')?.value || ''
        };

        if (!formData.city) return alert('Please select a State and District.');

        const res = await createBloodRequest(formData);
        if (res.success) {
            form.reset();
            showToast('Request Broadcasted!', `Notified ${res.notifiedCount} matching registered donors.`, 'success');
            document.querySelector('[data-target=view-my-status]')?.click();
        } else {
            alert(res.message);
        }
    });
}

/* ==========================================================================
   State / District Dropdowns
   ========================================================================== */
function populateAllStateDropdowns() {
    const pairs = [
        { state: 'donor-filter-state', dist: 'donor-filter-district', onChange: renderDonorsDirectory },
        { state: 'req-filter-state', dist: 'req-filter-district', onChange: renderRecipientsDirectory },
        { state: 'req-state', dist: 'req-district', onChange: null },
        { state: 'onboard-state', dist: 'onboard-district', onChange: null }
    ];

    pairs.forEach(({ state: stateId, dist: distId, onChange }) => {
        const stateSelect = document.getElementById(stateId);
        const distSelect = document.getElementById(distId);
        if (!stateSelect) return;

        stateSelect.innerHTML = stateId.includes('filter')
            ? `<option value="">All States</option>`
            : `<option value="">Select State</option>`;
        
        Object.keys(indiaStates).sort().forEach(state => {
            stateSelect.innerHTML += `<option value="${state}">${state}</option>`;
        });

        stateSelect.addEventListener('change', (e) => {
            const selectedState = e.target.value;
            if (!distSelect) return;
            distSelect.innerHTML = distId.includes('filter')
                ? `<option value="">All Districts</option>`
                : `<option value="">Select District</option>`;
            if (selectedState && indiaStates[selectedState]) {
                indiaStates[selectedState].forEach(dist => {
                    distSelect.innerHTML += `<option value="${dist}">${dist}</option>`;
                });
            }
            if (onChange) onChange();
        });

        if (distSelect && onChange) {
            distSelect.addEventListener('change', onChange);
        }
    });
}

/* ==========================================================================
   Notifications
   ========================================================================== */
function setupNotifDropdown() {
    const notifBtn = document.getElementById('notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const markAllBtn = document.getElementById('mark-all-read-btn');
    const clearAllBtn = document.getElementById('clear-all-notifs-btn');
    if (!notifBtn || !dropdown) return;

    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            requestBrowserNotificationPermission();
        }
    });

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const user = getCurrentUser();
            if (user) {
                await markAllNotificationsRead(user.uid);
                showToast("All read", "All notifications marked as read.", "info");
            }
        });
    }

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const user = getCurrentUser();
            if (user) {
                if (confirm("Are you sure you want to delete all your notifications?")) {
                    await clearAllNotifications(user.uid);
                    showToast("Cleared", "All notifications have been deleted.", "info");
                }
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!notifBtn.contains(e.target)) dropdown.style.display = 'none';
    });
}

window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
window.deleteSingleNotification = async function(notifId) {
    if (!notifId) return;
    const itemEl = document.querySelector(`.notif-card-item[data-id="${notifId}"]`);
    if (itemEl) {
        itemEl.style.opacity = '0';
        itemEl.style.transform = 'scale(0.95)';
        itemEl.style.transition = 'all 0.15s ease';
        setTimeout(() => {
            if (itemEl && itemEl.parentNode) {
                itemEl.remove();
                const list = document.getElementById('notif-list');
                if (list && list.querySelectorAll('.notif-card-item').length === 0) {
                    list.innerHTML = '<div class="notif-empty"><i class="far fa-bell-slash" style="font-size:1.5rem;margin-bottom:6px;display:block;opacity:0.6;"></i>No notifications yet.</div>';
                }
            }
        }, 150);
    }
    await deleteNotification(notifId);
    showToast("Deleted", "Notification deleted.", "info");
};

let currentNotifUnsubscribe = null;

function setupNotificationListener() {
    if (typeof currentNotifUnsubscribe === 'function') {
        currentNotifUnsubscribe();
        currentNotifUnsubscribe = null;
    }

    currentNotifUnsubscribe = subscribeToNotifications((notifs) => {
        const unreadCount = notifs.filter(n => !n.isRead).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
            badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        }

        const list = document.getElementById('notif-list');
        if (!list) return;
        if (notifs.length === 0) {
            list.innerHTML = '<div class="notif-empty"><i class="far fa-bell-slash" style="font-size:1.5rem;margin-bottom:6px;display:block;opacity:0.6;"></i>No notifications yet.</div>';
            return;
        }

        const currentUser = getCurrentUser();
        const isDonor = currentUser && currentUser.role === 'donor';

        list.innerHTML = notifs.slice(0, 25).map(n => {
            const notifId = n.notificationId || n.id;
            const icon = n.type === 'DIRECT_REQUEST' ? '🩸' : n.type === 'EMERGENCY_REQUEST' ? '🚨' : n.type === 'ACCEPTED' ? '✅' : n.type === 'REJECTED' ? '❌' : n.type === 'COMPLETED' ? '🎉' : '🔔';
            const isDirect = n.type === 'DIRECT_REQUEST';
            const isEmergency = n.type === 'EMERGENCY_REQUEST';
            const showActions = isDonor && (n.type === 'NEW_REQUEST' || isEmergency || isDirect) && n.requestId;
            const isUnread = !n.isRead;
            const borderCol = isEmergency ? '#ef4444' : isDirect ? '#c1121f' : n.type === 'ACCEPTED' ? '#10b981' : n.type === 'REJECTED' ? '#f43f5e' : '#3b82f6';

            return `
                <div class="notif-card-item ${isUnread ? 'unread' : ''}" 
                     data-id="${notifId}" 
                     style="border-left: 3px solid ${borderCol}; cursor: pointer;"
                     onclick="window.handleNotifClick('${notifId}', '${n.requestId || ''}', '${n.type}')">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                        <div style="font-weight:700;font-size:0.86rem;color:#0f172a; flex:1; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                            <span>${icon}</span>
                            <span>${n.title}</span>
                            ${isUnread ? '<span class="unread-dot" title="Unread"></span>' : ''}
                        </div>
                        <button class="notif-delete-btn" type="button" title="Delete notification" onclick="event.stopPropagation(); event.preventDefault(); window.deleteSingleNotification('${notifId}');">
                            <i class="fas fa-trash-alt" style="font-size:0.75rem; pointer-events:none;"></i>
                        </button>
                    </div>
                    ${isDirect ? '<div style="margin-top:3px;"><span class="badge badge-primary" style="font-size:0.65rem; padding:2px 6px;">🎯 DIRECT REQUEST FOR YOU</span></div>' : ''}
                    ${n.type === 'ACCEPTED' ? '<div style="margin-top:3px;"><span class="badge" style="background:#dcfce7;color:#15803d;font-size:0.65rem;padding:2px 6px;font-weight:700;border-radius:4px;">✅ REQUEST ACCEPTED</span></div>' : ''}
                    ${n.type === 'REJECTED' ? '<div style="margin-top:3px;"><span class="badge" style="background:#fee2e2;color:#b91c1c;font-size:0.65rem;padding:2px 6px;font-weight:700;border-radius:4px;">❌ DONOR DECLINED</span></div>' : ''}
                    ${n.type === 'COMPLETED' ? '<div style="margin-top:3px;"><span class="badge" style="background:#fef3c7;color:#b45309;font-size:0.65rem;padding:2px 6px;font-weight:700;border-radius:4px;">🎉 DONATION COMPLETED</span></div>' : ''}
                    <div style="font-size:0.78rem;color:#475569;margin-top:4px;line-height:1.35;">${n.message}</div>
                    <div style="font-size:0.7rem;color:#94a3b8;margin-top:4px;">${new Date(n.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} &bull; ${new Date(n.createdAt).toLocaleDateString()}</div>
                    ${showActions ? `
                    <div style="display:flex;gap:6px;margin-top:8px;" onclick="event.stopPropagation();">
                        <button onclick="window.acceptRequestFromDirectory('${n.requestId}');window.markNotificationRead('${notifId}');document.getElementById('notif-dropdown').style.display='none';"
                            class="btn btn-success btn-sm" style="flex:1;padding:5px 8px;font-size:0.75rem;">✅ Accept & Donate</button>
                        <button onclick="window.rejectRequest('${n.requestId}');window.markNotificationRead('${notifId}');document.getElementById('notif-dropdown').style.display='none';"
                            class="btn btn-secondary btn-sm" style="flex:1;padding:5px 8px;font-size:0.75rem;color:#ef4444;">❌ Decline</button>
                    </div>` : ''}
                </div>`;
        }).join('');
    });
}

window.handleNotifClick = async function(notifId, requestId, type) {
    if (notifId) {
        await markNotificationRead(notifId);
    }
    // Navigate to relevant section if applicable
    if (requestId) {
        const user = getCurrentUser();
        if (user && user.role === 'donor' && (type === 'NEW_REQUEST' || type === 'EMERGENCY_REQUEST' || type === 'DIRECT_REQUEST')) {
            document.querySelector('[data-target=view-requests]')?.click();
        } else {
            document.querySelector('[data-target=view-my-status]')?.click();
        }
    }
};

/* ==========================================================================
   Dashboard Renderer
   ========================================================================== */
function renderFullDashboard() {
    const user = getCurrentUser();
    if (!user) return;

    renderDonorStatusCard(document.getElementById('donor-status-container'));

    const isDonor = user.role === 'donor';
    const allDonations = localDb.getDonations();
    const myDonations = allDonations.filter(d => d.donorUid === user.uid);
    const totalUnits = myDonations.reduce((s, d) => s + (parseInt(d.units) || 1), 0);
    const myRequests = getMyRequests();

    const statsEl = document.getElementById('dashboard-stats');
    if (statsEl) {
        const stats = isDonor
            ? [
                { icon: '🩸', label: 'Units Donated', value: totalUnits, color: '#c1121f' },
                { icon: '🏆', label: 'Donations Completed', value: myDonations.length, color: '#c1121f' },
                { icon: user.isAvailable ? '🟢' : '🔴', label: 'Availability', value: user.isAvailable ? 'Available' : 'Unavailable', color: user.isAvailable ? '#10b981' : '#64748b' }
            ]
            : [
                { icon: '📋', label: 'Total Requests', value: myRequests.length, color: '#3b82f6' },
                { icon: '⏳', label: 'Open Requests', value: myRequests.filter(r => r.status === 'OPEN').length, color: '#f59e0b' },
                { icon: '✅', label: 'Fulfilled', value: myRequests.filter(r => r.status === 'COMPLETED').length, color: '#10b981' }
            ];
        statsEl.innerHTML = stats.map(s => `
            <div class="glass-card stat-metric-card">
                <div style="font-size:1.8rem;">${s.icon}</div>
                <div class="stat-num" style="color:${s.color};">${s.value}</div>
                <div class="stat-lbl">${s.label}</div>
            </div>`).join('');
    }

    const histEl = document.getElementById('dashboard-history');
    if (histEl) {
        if (isDonor) {
            histEl.innerHTML = `
                <h3 style="font-size:1.15rem;margin-bottom:12px;">🩸 My Donation History</h3>
                ${myDonations.length === 0
                    ? '<div class="glass-card empty-state-box" style="padding:24px;">No donations recorded yet.</div>'
                    : `<div style="display:flex;flex-direction:column;gap:10px;">${myDonations.map(d => `
                        <div class="glass-card" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;">
                            <div>
                                <div style="font-weight:700;font-size:0.92rem;">🏥 ${d.hospitalName}</div>
                                <div style="font-size:0.8rem;color:#64748b;">${new Date(d.completedAt).toLocaleDateString()}</div>
                            </div>
                            <div class="blood-badge sm">${d.bloodGroup}</div>
                        </div>`).join('')}</div>`
                }`;
        } else {
            histEl.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h3 style="font-size:1.15rem;margin:0;">📋 My Submitted Requests</h3>
                    <button class="btn btn-sm btn-secondary" onclick="document.querySelector('[data-target=view-my-status]').click()">Status Tracker &rarr;</button>
                </div>
                ${myRequests.length === 0
                    ? '<div class="glass-card empty-state-box" style="padding:24px;">No blood requests created yet.</div>'
                    : `<div style="display:flex;flex-direction:column;gap:10px;">${myRequests.slice(0, 5).map(r => `
                        <div class="glass-card" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;">
                            <div>
                                <div style="font-weight:700;font-size:0.92rem;">${r.bloodGroup} — ${r.hospitalName}</div>
                                <div style="font-size:0.8rem;color:#64748b;">${new Date(r.createdAt).toLocaleDateString()}</div>
                            </div>
                            <span class="badge badge-neutral">${r.status}</span>
                        </div>`).join('')}</div>`
                }`;
        }
    }
}

function updateUIPerRole(user) {
    const profileBtn = document.getElementById('user-profile-display');
    const notifBtn = document.getElementById('notif-btn');
    const googleBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const homeCta = document.getElementById('home-cta-container');

    if (!user) {
        if (profileBtn) profileBtn.style.display = 'none';
        if (notifBtn) notifBtn.style.display = 'none';
        if (googleBtn) googleBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        if (homeCta) {
            homeCta.innerHTML = `
                <button id="home-cta-login-btn" class="btn btn-primary btn-lg">
                    Sign In / Join Network <i class="fas fa-arrow-right"></i>
                </button>
            `;
            setTimeout(() => {
                document.getElementById('home-cta-login-btn')?.addEventListener('click', () => {
                    document.getElementById('google-login-btn').click();
                });
            }, 100);
        }
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
            <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="document.querySelector('[data-target=view-donors]').click()">
                    Find Donors <i class="fas fa-users"></i>
                </button>
                <button class="btn btn-secondary" onclick="document.querySelector('[data-target=view-create-request]').click()">
                    Request Blood <i class="fas fa-plus"></i>
                </button>
            </div>
        `;
    }
}

/* ==========================================================================
   Modals
   ========================================================================== */
window.showBecomeDonorModalFromNav = function() {
    const user = getCurrentUser();
    if (!user) {
        showToast('Login Required', 'Please sign in to register as a donor.', 'info');
        document.getElementById('google-login-btn')?.click();
        return;
    }
    showBecomeDonorModal(user);
};

function showBecomeDonorModal(user) {
    document.getElementById('become-donor-modal')?.remove();

    const stateOptions = Object.keys(indiaStates).sort().map(s =>
        `<option value="${s}" ${user.state === s ? 'selected' : ''}>${s}</option>`
    ).join('');
    const initDists = user.state && indiaStates[user.state]
        ? indiaStates[user.state].map(d => `<option value="${d}" ${user.city === d ? 'selected' : ''}>${d}</option>`).join('')
        : '';

    const modal = document.createElement('div');
    modal.id = 'become-donor-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex;z-index:9999;';
    modal.innerHTML = `
        <div class="glass-card modal-content">
            <h2 style="margin-bottom:6px;color:#c1121f;font-size:1.3rem;">🩸 Register as a Blood Donor</h2>
            <p style="color:#64748b;font-size:0.85rem;margin-bottom:20px;">Join the donor directory so patients & hospitals in your district can reach you.</p>
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
                        <input type="number" id="bd-age" class="form-control" value="${user.age || '25'}" placeholder="18–65" min="18" max="65" required>
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
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button type="submit" class="btn btn-primary" style="flex:1;">Join Donor List 🩸</button>
                    <button type="button" id="bd-cancel" class="btn btn-secondary" style="flex:1;">Cancel</button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(modal);

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
        if (!state || !district) return alert('Please select a State and District.');

        const updates = {
            role: 'donor',
            isAvailable: true,
            bloodGroup: modal.querySelector('#bd-blood').value,
            age: parseInt(modal.querySelector('#bd-age').value),
            state: state,
            city: district,
            address: area || district
        };
        await updateUserProfile(updates);
        syncUserToLocalDb({ ...getCurrentUser(), ...updates });
        modal.remove();
        showToast('Welcome, Donor Hero! 🩸', 'You are now visible in the donor network.', 'success');
        renderFullDashboard();
        renderDonorsDirectory();
    });
}
