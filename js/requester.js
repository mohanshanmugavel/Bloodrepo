/* ==========================================================================
   Requester Features
   Create Blood Requests, Match Donors, and Broadcast Notifications
   ========================================================================== */

import { getCurrentUser } from './auth.js';
import { localDb, isRealFirebaseConfigured, db } from './firebase-config.js';
import { findMatchingDonors } from './matching.js';
import { createNotification, showToast } from './notifications.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function createBloodRequest(formData) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Must be logged in" };

  const newRequest = {
    requestId: 'req_' + Date.now(),
    requesterId: user.uid,
    requesterName: user.name,
    patientName: formData.patientName,
    bloodGroup: formData.bloodGroup,
    unitsRequired: parseInt(formData.unitsRequired) || 1,
    hospitalName: formData.hospitalName,
    city: formData.city,
    address: formData.address || formData.city,
    state: formData.state || '',
    location: {
      latitude: parseFloat(formData.latitude) || 9.9185,
      longitude: parseFloat(formData.longitude) || 78.1402
    },
    emergencyLevel: formData.emergencyLevel || 'NORMAL',
    requiredDate: formData.requiredDate || new Date().toISOString(),
    contactPhone: formData.contactPhone || user.phone || '',
    contactEmail: formData.contactEmail || user.email || '',
    note: formData.note || '',
    selectedDonorIds: formData.selectedDonorIds || [],
    status: 'OPEN',
    acceptedDonorId: null,
    acceptedDonorName: null,
    acceptedDonorPhone: null,
    createdAt: new Date().toISOString()
  };

  if (isRealFirebaseConfigured) {
    try {
      await addDoc(collection(db, "bloodRequests"), newRequest);
    } catch (err) {
      console.error(err);
    }
  }

  const requests = localDb.getRequests();
  requests.push(newRequest);
  localDb.saveRequests(requests);

  // ---- Determine donors to notify ----
  // Gather all donors: localStorage + current user if donor
  let allLocalDonors = localDb.getUsers().filter(u => u.role === 'donor' && u.isAvailable);
  
  // Include current user in donor pool if they are a donor (Firebase user may not be in localStorage)
  if (user.role === 'donor' && user.isAvailable) {
    if (!allLocalDonors.find(d => d.uid === user.uid)) {
      allLocalDonors.push(user);
      // Also persist to localStorage for future searches
      const allUsers = localDb.getUsers();
      if (!allUsers.find(u => u.uid === user.uid)) {
        allUsers.push(user);
        localDb.saveUsers(allUsers);
      }
    }
  }

  let donorsToNotify;
  if (newRequest.selectedDonorIds && newRequest.selectedDonorIds.length > 0) {
    // User hand-picked specific donors
    donorsToNotify = allLocalDonors.filter(d => newRequest.selectedDonorIds.includes(d.uid));
  } else {
    // Auto-match by blood group + location proximity (top 10)
    const matchingDonors = findMatchingDonors(
      newRequest.bloodGroup,
      newRequest.location,
      allLocalDonors,
      { onlyAvailable: true, onlyEligible: false }
    );
    donorsToNotify = matchingDonors.slice(0, 10);
  }

  // Send notifications
  for (const donor of donorsToNotify) {
    await createNotification({
      recipientUid: donor.uid,
      title: newRequest.emergencyLevel === 'CRITICAL' ? '🚨 URGENT EMERGENCY REQUEST' : '🩸 New Blood Request',
      message: `${newRequest.hospitalName} in ${newRequest.city} needs ${newRequest.unitsRequired} unit(s) of ${newRequest.bloodGroup}. Patient: ${newRequest.patientName}.`,
      type: newRequest.emergencyLevel === 'CRITICAL' ? 'EMERGENCY_REQUEST' : 'NEW_REQUEST',
      requestId: newRequest.requestId
    });
  }

  return { success: true, request: newRequest, notifiedCount: donorsToNotify.length };
}

export async function acceptBloodRequestByDonor(requestId) {
  const user = getCurrentUser();
  if (!user || user.role !== 'donor') return { success: false, message: 'Only donors can accept requests' };

  const requests = localDb.getRequests();
  const idx = requests.findIndex(r => r.requestId === requestId);
  if (idx === -1) return { success: false, message: 'Request not found' };

  const req = requests[idx];
  if (req.acceptedDonorId) return { success: false, message: 'This request has already been accepted by another donor' };

  // Mark accepted
  requests[idx] = {
    ...req,
    status: 'ACCEPTED',
    acceptedDonorId: user.uid,
    acceptedDonorName: user.name,
    acceptedDonorPhone: user.phone || '',
    acceptedAt: new Date().toISOString()
  };
  localDb.saveRequests(requests);

  // Notify requester with donor contact details
  await createNotification({
    recipientUid: req.requesterId,
    title: '✅ Donor Found!',
    message: `${user.name} (${user.bloodGroup}, 📞 ${user.phone || 'No phone'}) has accepted your request for ${req.patientName} at ${req.hospitalName}.`,
    type: 'ACCEPTED',
    requestId: requestId
  });

  showToast('Request Accepted!', `You accepted the request from ${req.requesterName}. Their contact: ${req.contactPhone}`, 'success');
  return { success: true };
}

export async function rejectBloodRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false };

  // Just create a "rejected" notification record (soft reject - request stays OPEN for others)
  const requests = localDb.getRequests();
  const req = requests.find(r => r.requestId === requestId);
  if (!req) return { success: false };

  // Notify requester
  await createNotification({
    recipientUid: req.requesterId,
    title: '❌ Donor Unavailable',
    message: `A donor was unable to fulfil the request for ${req.patientName}. Your request is still open for other donors.`,
    type: 'REJECTED',
    requestId: requestId
  });

  return { success: true };
}

export function getMyRequests() {
  const user = getCurrentUser();
  if (!user) return [];
  const allReqs = localDb.getRequests();
  return allReqs.filter(r => r.requesterId === user.uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
