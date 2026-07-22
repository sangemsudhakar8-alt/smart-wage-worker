/**
 * Haversine formula to calculate the distance between two points on Earth
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371000; // Radius of Earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1)); // Return distance in meters
};

/**
 * Default tracking radius in meters
 */
export const DEFAULT_TRACKING_RADIUS = 100;

/**
 * Checks if a point is within a given radius of another point
 * @param {number} lat1 - Center latitude
 * @param {number} lon1 - Center longitude
 * @param {number} lat2 - Test latitude
 * @param {number} lon2 - Test longitude
 * @param {number} radiusInMeters - Radius in meters
 * @returns {boolean}
 */
export const isWithinRadius = (lat1, lon1, lat2, lon2, radiusInMeters = DEFAULT_TRACKING_RADIUS) => {
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    if (distance === null) return true; // Assume within if coords missing
    return distance <= radiusInMeters;
};
