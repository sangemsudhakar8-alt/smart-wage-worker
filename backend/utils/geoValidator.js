/**
 * Geographic validation helper functions.
 */

/**
 * Validates coordinate pair and optional radius.
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [radius] - Optional radius in meters
 * @returns {boolean}
 */
export const isValidCoordinate = (latitude, longitude) => {
    if (latitude == null || longitude == null) return false;
    
    const lat = Number(latitude);
    const lng = Number(longitude);
    
    if (isNaN(lat) || isNaN(lng)) return false;
    
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/**
 * Validates whether a radius is a positive integer.
 * @param {number} radius
 * @returns {boolean}
 */
export const isValidRadius = (radius) => {
    if (radius == null) return false;
    const rad = Number(radius);
    return !isNaN(rad) && rad > 0;
};
