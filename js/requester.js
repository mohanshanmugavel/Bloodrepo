import { getCurrentUser } from './auth.js';
import { localDb, isRealFirebaseConfigured, db } from './firebase-config.js';
import { BLOOD_COMPATIBILITY } from './matching.js';
import { createNotification, showToast } from './notifications.js';
import { doc, setDoc, updateDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
    emergencyLevel: formData.emergencyLevel || 'NORMAL',
    requiredDate: formData.requiredDate || new Date().toISOString(),
    contactPhone: formData.contactPhone || user.phone || '',
    contactEmail: formData.contactEmail || user.email || '',
    note: formData.note || '',
    selectedDonorIds: formData.selectedDonorIds || [],
    status: 'OPEN', // 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED'
    acceptedDonorId: null,
    acceptedDonorName: null,
    acceptedDonorPhone: null,
    createdAt: new Date().toISOString()
  };

  if (isRealFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "bloodRequests", newRequest.requestId), newRequest);
    } catch (err) {
      console.error("Firestore create request error:", err);
    }
  }

  const requests = localDb.getRequests();
  const existingIdx = requests.findIndex(r => r.requestId === newRequest.requestId);
  if (existingIdx === -1) {
    requests.push(newRequest);
  } else {
    requests[existingIdx] = newRequest;
  }
  localDb.saveRequests(requests);

  // Retrieve donors across local & Firestore
  let allDonorsMap = new Map();
  localDb.getUsers().forEach(u => {
    if (u && u.uid && u.role === 'donor' && u.isAvailable !== false) {
      allDonorsMap.set(u.uid, u);
    }
  });

  if (isRealFirebaseConfigured && db) {
    try {
      const donorSnap = await getDocs(query(collection(db, "users"), where("role", "==", "donor")));
      donorSnap.forEach(docSnap => {
        const u = { ...docSnap.data(), uid: docSnap.id };
        if (u.isAvailable !== false) {
          allDonorsMap.set(u.uid, u);
        }
      });
    } catch (err) {
      console.warn("Could not query Firestore donors:", err);
    }
  }

  const compatibleGroups = BLOOD_COMPATIBILITY[newRequest.bloodGroup] || [newRequest.bloodGroup];
  const donorsToNotify = Array.from(allDonorsMap.values()).filter(d => {
    if (d.uid === user.uid) return false;
    if (newRequest.selectedDonorIds && newRequest.selectedDonorIds.includes(d.uid)) return true;
    const matchesBlood = compatibleGroups.includes(d.bloodGroup) || d.bloodGroup === newRequest.bloodGroup;
    return matchesBlood;
  });

  for (const donor of donorsToNotify) {
    await createNotification({
      recipientUid: donor.uid,
      title: newRequest.emergencyLevel === 'CRITICAL' ? '🚨 URGENT EMERGENCY REQUEST' : '🩸 New Blood Request Received',
      message: `${newRequest.hospitalName} in ${newRequest.city || 'your area'} needs ${newRequest.unitsRequired} unit(s) of ${newRequest.bloodGroup} blood for ${newRequest.patientName}.`,
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
  if (req.acceptedDonorId && req.acceptedDonorId !== user.uid) {
    return { success: false, message: 'This request has already been accepted by another donor' };
  }

  const updatedReq = {
    ...req,
    status: 'ACCEPTED',
    acceptedDonorId: user.uid,
    acceptedDonorName: user.name,
    acceptedDonorPhone: user.phone || '',
    acceptedAt: new Date().toISOString()
  };

  requests[idx] = updatedReq;
  localDb.saveRequests(requests);

  if (isRealFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "bloodRequests", req.requestId), {
        status: 'ACCEPTED',
        acceptedDonorId: user.uid,
        acceptedDonorName: user.name,
        acceptedDonorPhone: user.phone || '',
        acceptedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Firestore update error on accept:", err);
    }
  }

  // Notify requester with donor contact details
  await createNotification({
    recipientUid: req.requesterId,
    title: '✅ Request Accepted by Donor!',
    message: `${user.name} (${user.bloodGroup || 'Donor'}, 📞 ${user.phone || 'Contact provided'}) has accepted your request for ${req.patientName} at ${req.hospitalName}.`,
    type: 'ACCEPTED',
    requestId: requestId
  });

  showToast('Request Accepted!', `You accepted the request for ${req.patientName}. Requester phone: ${req.contactPhone || 'Provided'}`, 'success');
  return { success: true, request: updatedReq };
}

export async function rejectBloodRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Must be logged in" };

  const requests = localDb.getRequests();
  const req = requests.find(r => r.requestId === requestId);
  if (!req) return { success: false, message: "Request not found" };

  const isDirectOrAssigned = req.isDirectRequest || req.acceptedDonorId === user.uid;
  if (isDirectOrAssigned) {
    req.status = 'REJECTED';
    req.rejectedByDonorId = user.uid;
    req.rejectedByDonorName = user.name;
    req.rejectedAt = new Date().toISOString();
    req.acceptedDonorId = null;
    req.acceptedDonorName = null;
    req.acceptedDonorPhone = null;
  } else {
    if (!req.declinedDonorIds) req.declinedDonorIds = [];
    if (!req.declinedDonorIds.includes(user.uid)) req.declinedDonorIds.push(user.uid);
  }

  localDb.saveRequests(requests);

  if (isRealFirebaseConfigured && db) {
    try {
      if (req.status === 'REJECTED') {
        await updateDoc(doc(db, "bloodRequests", req.requestId), {
          status: 'REJECTED',
          rejectedByDonorId: user.uid,
          rejectedByDonorName: user.name,
          rejectedAt: new Date().toISOString(),
          acceptedDonorId: null,
          acceptedDonorName: null,
          acceptedDonorPhone: null
        });
      }
    } catch(err) {
      console.warn("Firestore reject update error:", err);
    }
  }

  // Notify requester that this donor declined
  await createNotification({
    recipientUid: req.requesterId,
    title: '❌ Request Declined by Donor',
    message: `${user.name} (${user.bloodGroup || 'Donor'}) was unable to accept your request for ${req.patientName}. Your request status has been updated.`,
    type: 'REJECTED',
    requestId: requestId
  });

  return { success: true };
}

export async function reopenBloodRequestAsBroadcast(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Must be logged in" };

  const requests = localDb.getRequests();
  const idx = requests.findIndex(r => r.requestId === requestId);
  if (idx === -1) return { success: false, message: "Request not found" };

  const req = requests[idx];
  req.status = 'OPEN';
  req.isDirectRequest = false;
  req.targetDonorId = null;
  req.targetDonorName = null;
  req.rejectedByDonorId = null;
  req.rejectedByDonorName = null;
  req.acceptedDonorId = null;
  req.acceptedDonorName = null;
  req.acceptedDonorPhone = null;

  localDb.saveRequests(requests);

  if (isRealFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "bloodRequests", req.requestId), {
        status: 'OPEN',
        isDirectRequest: false,
        targetDonorId: null,
        targetDonorName: null,
        rejectedByDonorId: null,
        rejectedByDonorName: null,
        acceptedDonorId: null,
        acceptedDonorName: null,
        acceptedDonorPhone: null
      });
    } catch(e) {
      console.warn("Firestore reopen update error:", e);
    }
  }

  // Notify all compatible donors
  let allDonorsMap = new Map();
  localDb.getUsers().forEach(u => {
    if (u && u.uid && u.role === 'donor' && u.isAvailable !== false) {
      allDonorsMap.set(u.uid, u);
    }
  });

  const compatibleGroups = BLOOD_COMPATIBILITY[req.bloodGroup] || [req.bloodGroup];
  const donorsToNotify = Array.from(allDonorsMap.values()).filter(d => {
    if (d.uid === user.uid) return false;
    return compatibleGroups.includes(d.bloodGroup) || d.bloodGroup === req.bloodGroup;
  });

  for (const donor of donorsToNotify) {
    await createNotification({
      recipientUid: donor.uid,
      title: '🩸 Reopened Blood Request Available',
      message: `${req.hospitalName} in ${req.city || 'your area'} needs ${req.unitsRequired} unit(s) of ${req.bloodGroup} for ${req.patientName}.`,
      type: 'NEW_REQUEST',
      requestId: req.requestId
    });
  }

  showToast("Broadcast Reopened", "Your request is now open to all compatible donors.", "success");
  return { success: true, request: req };
}

export async function createDirectDonorRequest(targetDonor, formData) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Must be logged in" };

  const newRequest = {
    requestId: 'req_direct_' + Date.now(),
    requesterId: user.uid,
    requesterName: user.name,
    patientName: formData.patientName || 'Patient',
    bloodGroup: targetDonor.bloodGroup || formData.bloodGroup,
    unitsRequired: parseInt(formData.unitsRequired) || 1,
    hospitalName: formData.hospitalName,
    city: formData.city || targetDonor.city || '',
    address: formData.address || targetDonor.address || '',
    state: formData.state || targetDonor.state || '',
    emergencyLevel: formData.emergencyLevel || 'URGENT',
    requiredDate: formData.requiredDate || new Date().toISOString(),
    contactPhone: formData.contactPhone || user.phone || '',
    note: formData.note || `Direct request to ${targetDonor.name}`,
    targetDonorId: targetDonor.uid,
    targetDonorName: targetDonor.name,
    isDirectRequest: true,
    status: 'OPEN',
    acceptedDonorId: null,
    acceptedDonorName: null,
    acceptedDonorPhone: null,
    createdAt: new Date().toISOString()
  };

  if (isRealFirebaseConfigured && db) {
    try {
      await setDoc(doc(db, "bloodRequests", newRequest.requestId), newRequest);
    } catch (err) {
      console.error("Firestore direct request error:", err);
    }
  }

  const requests = localDb.getRequests();
  const existingIdx = requests.findIndex(r => r.requestId === newRequest.requestId);
  if (existingIdx === -1) {
    requests.push(newRequest);
  } else {
    requests[existingIdx] = newRequest;
  }
  localDb.saveRequests(requests);

  // Send direct notification specifically to this individual donor
  await createNotification({
    recipientUid: targetDonor.uid,
    title: `🩸 Direct Request: ${user.name} asked for your help!`,
    message: `${user.name} requested ${newRequest.unitsRequired} unit(s) of ${newRequest.bloodGroup} for ${newRequest.patientName} at ${newRequest.hospitalName}. Contact: ${newRequest.contactPhone}`,
    type: 'DIRECT_REQUEST',
    requestId: newRequest.requestId
  });

  return { success: true, request: newRequest };
}

export async function cancelBloodRequest(requestId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "Log in required" };

  const requests = localDb.getRequests();
  const idx = requests.findIndex(r => r.requestId === requestId);
  if (idx === -1) return { success: false, message: "Request not found" };

  const req = requests[idx];
  requests[idx].status = 'CANCELLED';
  localDb.saveRequests(requests);

  if (isRealFirebaseConfigured && db) {
    try {
      await updateDoc(doc(db, "bloodRequests", req.requestId), {
        status: 'CANCELLED'
      });
    } catch (err) {
      console.error("Firestore cancel error:", err);
    }
  }

  // If there was an accepted donor assigned, notify them of cancellation
  if (req.acceptedDonorId) {
    await createNotification({
      recipientUid: req.acceptedDonorId,
      title: 'ℹ️ Blood Request Cancelled',
      message: `The blood request for ${req.patientName} at ${req.hospitalName} was cancelled by the requester.`,
      type: 'INFO',
      requestId: req.requestId
    });
  }

  showToast('Request Cancelled', 'Your blood request has been closed.', 'info');
  return { success: true };
}

export function getMyRequests() {
  const user = getCurrentUser();
  if (!user) return [];
  const allReqs = localDb.getRequests();
  
  // Deduplicate by requestId or patientName + createdAt
  const myMap = new Map();
  allReqs.forEach(r => {
    if (r && r.requesterId === user.uid) {
      const key = r.requestId || `${r.patientName}_${r.createdAt}`;
      if (!myMap.has(key)) {
        myMap.set(key, r);
      } else {
        const existing = myMap.get(key);
        if (r.status === 'ACCEPTED' || r.status === 'COMPLETED' || r.status === 'REJECTED' || r.acceptedDonorName) {
          myMap.set(key, r);
        }
      }
    }
  });

  return Array.from(myMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
