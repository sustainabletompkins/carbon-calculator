const EARTH_RADIUS_MILES = 3958.8;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two places (Haversine formula)
 * @param {Object} origin - Origin location with lat/lng
 * @param {Object} destination - Destination location with lat/lng
 * @returns {number} Distance in miles
 */
export const greatCircleMiles = (origin, destination) => {
  const { lat: lat1, lng: lng1 } = origin.location;
  const { lat: lat2, lng: lng2 } = destination.location;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
};
