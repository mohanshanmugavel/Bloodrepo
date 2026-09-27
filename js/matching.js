/* ==========================================================================
   Smart Donor Matching & Distance Calculation Algorithm
   ABO/Rh Blood Compatibility Matrix + Haversine Geospatial Distance Formula
   ========================================================================== */

// ABO & Rh Blood Donor Compatibility Rules Matrix
// Key = Recipient Blood Group, Value = Array of Compatible Donor Blood Groups
export const BLOOD_COMPATIBILITY = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"] // Universal Recipient
};

/**
 * Calculates Haversine distance in kilometers between two lat/lng coordinates
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in kilometers (rounded to 1 decimal place)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const R = 6371; // Radius of Earth in KM
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Calculates days remaining until donor is next eligible (90-day cooldown)
 * @param {string} lastDonationDate YYYY-MM-DD
 * @returns {object} { isEligible: boolean, daysRemaining: number }
 */
export function checkDonorEligibility(lastDonationDate) {
  if (!lastDonationDate) return { isEligible: true, daysRemaining: 0 };
  
  const last = new Date(lastDonationDate);
  const today = new Date();
  const diffTime = Math.abs(today - last);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const cooldown = 90; // Standard 90 days interval between blood donations
  if (diffDays >= cooldown) {
    return { isEligible: true, daysRemaining: 0 };
  } else {
    return { isEligible: false, daysRemaining: cooldown - diffDays };
  }
}

/**
 * Smart Matching Engine
 * Filters and sorts donors based on Blood Group, Distance, Availability, and Eligibility
 */
export function findMatchingDonors(requiredBloodGroup, targetLocation, donorsList, filters = {}) {
  const compatibleGroups = BLOOD_COMPATIBILITY[requiredBloodGroup] || [requiredBloodGroup];

  return donorsList
    .filter(donor => {
      // 1. Role must be donor and status active
      if (donor.role !== 'donor' || donor.status !== 'active') return false;

      // 2. Blood compatibility check
      const matchesBlood = compatibleGroups.includes(donor.bloodGroup);
      if (!matchesBlood) return false;

      // 3. Availability check
      if (filters.onlyAvailable && !donor.isAvailable) return false;

      // 4. Eligibility check
      if (filters.onlyEligible) {
        const eligibility = checkDonorEligibility(donor.lastDonationDate);
        if (!eligibility.isEligible) return false;
      }

      // 5. City filter if specified
      if (filters.city && filters.city !== "All" && donor.city.toLowerCase() !== filters.city.toLowerCase()) {
        return false;
      }

      return true;
    })
    .map(donor => {
      // Compute proximity distance from target location (e.g. hospital/request coordinates)
      const distance = calculateDistance(
        targetLocation.latitude,
        targetLocation.longitude,
        donor.location.latitude,
        donor.location.longitude
      );
      
      const eligibility = checkDonorEligibility(donor.lastDonationDate);

      return {
        ...donor,
        distanceKM: distance,
        eligibility
      };
    })
    .sort((a, b) => a.distanceKM - b.distanceKM); // Sort ascending by proximity distance in KM
}
