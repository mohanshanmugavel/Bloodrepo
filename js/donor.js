/* ==========================================================================
   Donor Features & Operations
   Availability toggle, incoming request acceptance, donation history, certificates
   ========================================================================== */

import { getCurrentUser, updateUserProfile } from './auth.js';
import { localDb, isRealFirebaseConfigured, db } from './firebase-config.js';
import { checkDonorEligibility } from './matching.js';
import { createNotification } from './notifications.js';
import { doc, updateDoc, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function toggleDonorAvailability(isAvailable) {
  const user = getCurrentUser();
  if (!user) return;

  const result = await updateUserProfile({ isAvailable });
  return result;
}

export function renderDonorStatusCard(containerEl) {
  const user = getCurrentUser();
  if (!user) {
    containerEl.innerHTML = '';
    return;
  }

  const isDonor = user.role === 'donor';
  const eligibility = isDonor ? checkDonorEligibility(user.lastDonationDate) : null;
  const statusColor = isDonor && user.isAvailable ? 'var(--success)' : (isDonor ? 'var(--text-muted)' : '#3b82f6');
  
  // Calculate total units donated
  const allDonations = localDb.getDonations();
  const myDonations = allDonations.filter(d => d.donorUid === user.uid);
  const totalUnitsDonated = myDonations.reduce((sum, d) => sum + (parseInt(d.units) || 1), 0);

  let rightPanelHtml = '';
  let bottomBannerHtml = '';

  if (isDonor) {
      rightPanelHtml = `
        <div style="display: flex; align-items: center; gap: 20px;">
          <!-- Availability Toggle Switch -->
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">Availability Status</span>
            <label class="switch-label">
              <span style="font-size: 0.9rem; font-weight: 600; color: ${user.isAvailable ? 'var(--success)' : 'var(--text-muted)'};">
                ${user.isAvailable ? '🟢 Available' : '🔴 Unavailable'}
              </span>
              <div class="switch">
                <input type="checkbox" id="donor-avail-toggle" ${user.isAvailable ? 'checked' : ''}>
                <span class="slider"></span>
              </div>
            </label>
          </div>
        </div>
      `;

      bottomBannerHtml = `
      <!-- Eligibility Progress Banner -->
      <div style="margin-top: 20px; padding: 14px; background: rgba(15, 23, 42, 0.6); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">${eligibility.isEligible ? '✅' : '⏳'}</span>
          <div>
            <div style="font-size: 0.9rem; font-weight: 600;">
              ${eligibility.isEligible ? 'Eligible to Donate Blood Today!' : `Cooldown Period Active (${eligibility.daysRemaining} Days Left)`}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Last Donation Date: ${user.lastDonationDate || 'None recorded'} (90-day safe interval)
            </div>
          </div>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary" id="update-donation-date-btn">📅 Log New Donation Date</button>
        </div>
      </div>`;
  } else {
      rightPanelHtml = `
        <div>
            <button class="btn btn-primary" id="become-donor-btn">Become a Blood Donor</button>
        </div>
      `;
  }

  containerEl.innerHTML = `
    <div class="glass-card mb-4" style="border-left: 6px solid ${statusColor};">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div class="blood-badge lg">${user.bloodGroup || '?'}</div>
          <div>
            <h3 style="font-size: 1.2rem; margin-bottom: 4px;">Hello, ${user.name} 👋</h3>
            <p style="font-size: 0.88rem; color: var(--text-muted);">
              Location: <strong>${user.city || 'N/A'} (${user.address || 'N/A'})</strong> | Age: <strong>${user.age || 'N/A'}</strong>
            </p>
            ${isDonor ? `<p style="font-size: 0.9rem; margin-top: 5px; color: #c1121f; font-weight: bold;">Total Units Donated: ${totalUnitsDonated}</p>` : ''}
          </div>
        </div>
        ${rightPanelHtml}
      </div>
      ${bottomBannerHtml}
    </div>
  `;

  // Attach event listener for availability toggle
  const toggleInput = containerEl.querySelector('#donor-avail-toggle');
  if (toggleInput) {
    toggleInput.addEventListener('change', async (e) => {
      await toggleDonorAvailability(e.target.checked);
      renderDonorStatusCard(containerEl);
    });
  }

  // Attach listener for Become Donor
  const becomeDonorBtn = containerEl.querySelector('#become-donor-btn');
  if (becomeDonorBtn) {
      becomeDonorBtn.addEventListener('click', async () => {
          await updateUserProfile({ role: 'donor', isAvailable: true });
          renderDonorStatusCard(containerEl);
      });
  }
}

export async function acceptBloodRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Log in required" };

  const requests = localDb.getRequests();
  const reqIndex = requests.findIndex(r => r.requestId === requestId);
  if (reqIndex === -1) return { success: false, message: "Request not found" };

  const request = requests[reqIndex];
  request.status = 'ACCEPTED';
  request.acceptedDonorId = user.uid;
  request.acceptedDonorName = user.name;
  request.acceptedDonorPhone = user.phone;

  if (isRealFirebaseConfigured) {
    try {
      await updateDoc(doc(db, "bloodRequests", requestId), {
        status: 'ACCEPTED',
        acceptedDonorId: user.uid,
        acceptedDonorName: user.name,
        acceptedDonorPhone: user.phone
      });
    } catch (err) {
      console.error(err);
    }
  }

  localDb.saveRequests(requests);

  // Send notification to Requester
  await createNotification({
    recipientUid: request.requesterId,
    title: "✅ Blood Request Accepted!",
    message: `Donor ${user.name} (${user.bloodGroup}) accepted your request for ${request.hospitalName}. Contact: ${user.phone}`,
    type: "ACCEPTED",
    requestId: request.requestId
  });

  return { success: true, request };
}

export async function markDonationCompleted(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Log in required" };

  const requests = localDb.getRequests();
  const reqIndex = requests.findIndex(r => r.requestId === requestId);
  if (reqIndex === -1) return { success: false, message: "Request not found" };

  const request = requests[reqIndex];
  request.status = 'COMPLETED';

  localDb.saveRequests(requests);

  // Record in Donation History
  const newDonation = {
    donationId: 'don_' + Date.now(),
    requestId: request.requestId,
    donorUid: user.uid,
    donorName: user.name,
    requesterUid: request.requesterId,
    requesterName: request.requesterName,
    hospitalName: request.hospitalName,
    bloodGroup: request.bloodGroup,
    units: request.unitsRequired,
    completedAt: new Date().toISOString()
  };

  const donations = localDb.getDonations();
  donations.push(newDonation);
  localDb.saveDonations(donations);

  // Update donor's last donation date to today
  const todayStr = new Date().toISOString().split('T')[0];
  await updateUserProfile({ lastDonationDate: todayStr });

  // Notify requester
  await createNotification({
    recipientUid: request.requesterId,
    title: "🎉 Donation Completed!",
    message: `The blood donation for ${request.patientName} at ${request.hospitalName} has been marked as completed. Thank you!`,
    type: "COMPLETED",
    requestId: request.requestId
  });

  return { success: true, donation: newDonation };
}

export function generateCertificateHTML(donation) {
  return `
    <div style="padding: 30px; background: #fff; color: #1e293b; border: 10px double #ef4444; border-radius: 12px; text-align: center; font-family: 'Outfit', sans-serif;">
      <div style="font-size: 2.5rem; color: #ef4444; margin-bottom: 10px;">🩸 LifePulse Certificate of Appreciation</div>
      <p style="font-size: 1.1rem; color: #64748b;">This certificate is proudly presented to</p>
      <h2 style="font-size: 2.2rem; color: #0f172a; margin: 15px 0; border-bottom: 2px solid #ef4444; display: inline-block; padding-bottom: 6px;">
        ${donation.donorName || 'Blood Donor Hero'}
      </h2>
      <p style="font-size: 1.05rem; line-height: 1.6; margin: 20px 0;">
        For selflessly donating <strong>${donation.units || 1} Unit(s) of ${donation.bloodGroup} Blood</strong> at<br>
        <strong>${donation.hospitalName}</strong> on <strong>${new Date(donation.completedAt).toLocaleDateString()}</strong>,<br>
        helping save a precious human life.
      </p>
      <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 40px;">
        <div>
          <div style="font-size: 0.85rem; color: #64748b;">Date</div>
          <strong>${new Date(donation.completedAt).toLocaleDateString()}</strong>
        </div>
        <div style="text-align: center;">
          <div style="font-family: cursive; font-size: 1.4rem; color: #ef4444;">LifePulse Network</div>
          <div style="font-size: 0.8rem; color: #64748b;">Authorized Verification</div>
        </div>
      </div>
    </div>
  `;
}

// Global functions for inline onclick handlers
window.acceptRequestFromDash = async function(requestId) {
    const res = await acceptBloodRequest(requestId);
    if (res.success) {
        alert("Request Accepted successfully! The requester has been notified.");
        // Refresh dashboard
        if (typeof window.renderDashboardRequests === 'function') {
            window.renderDashboardRequests();
        }
    } else {
        alert("Failed to accept request: " + res.message);
    }
};

window.acceptRequestFromMap = window.acceptRequestFromDash;

window.reportNoShow = async function(requestId) {
    if (!confirm("Are you sure you want to report this donor for not showing up? This will penalize their credibility.")) return;

    const user = getCurrentUser();
    if (!user) return alert("Must be logged in");

    const requests = localDb.getRequests();
    const reqIndex = requests.findIndex(r => r.requestId === requestId);
    if (reqIndex === -1) return alert("Request not found");

    const request = requests[reqIndex];
    const donorId = request.acceptedDonorId;

    if (!donorId) return alert("No donor assigned to this request yet.");

    // Update request status
    request.status = 'OPEN'; // Reopen the request
    request.acceptedDonorId = null;
    request.acceptedDonorName = null;
    localDb.saveRequests(requests);

    // Penalize Donor - update their status to inactive or banned in Firestore/LocalDb
    const allUsers = localDb.getUsers();
    const donorIndex = allUsers.findIndex(u => u.uid === donorId);
    if (donorIndex !== -1) {
        allUsers[donorIndex].status = 'inactive';
        allUsers[donorIndex].flakeReported = true;
        localDb.saveUsers(allUsers);
        
        // Notify Donor of penalty
        await createNotification({
            recipientUid: donorId,
            title: "⚠️ Credibility Penalty Applied",
            message: "You were reported for a No-Show on an accepted blood request. Your profile has been temporarily deactivated.",
            type: "REJECTED",
            requestId: request.requestId
        });
    }

    if (isRealFirebaseConfigured) {
        try {
            await updateDoc(doc(db, "bloodRequests", requestId), {
                status: 'OPEN',
                acceptedDonorId: null,
                acceptedDonorName: null
            });
            await updateDoc(doc(db, "users", donorId), {
                status: 'inactive',
                flakeReported: true
            });
        } catch (e) {
            console.error("Firebase update failed", e);
        }
    }

    alert("Donor reported successfully. Your request has been re-opened for other nearby donors.");
    if (typeof window.renderDashboardRequests === 'function') {
        window.renderDashboardRequests();
    }
};
