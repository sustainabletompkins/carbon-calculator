/**
 * Google Routes API utility functions
 */

const GOOGLE_ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Calculate route using Google Routes API
 * @param {Object} origin - Origin location with lat/lng
 * @param {Object} destination - Destination location with lat/lng
 * @param {string} travelMode - Travel mode (DRIVE, WALK, BICYCLE, TRANSIT)
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<Object>} Route response with distance and duration
 */
export const computeRoute = async (
  origin,
  destination,
  travelMode = "DRIVE",
  apiKey
) => {
  if (
    !origin?.location?.lat ||
    !origin?.location?.lng ||
    !destination?.location?.lat ||
    !destination?.location?.lng
  ) {
    throw new Error("Invalid origin or destination coordinates");
  }

  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.location.lat,
          longitude: origin.location.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.location.lat,
          longitude: destination.location.lng,
        },
      },
    },
    travelMode: travelMode,
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    languageCode: "en-US",
    units: "IMPERIAL",
  };

  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
    "X-Goog-FieldMask":
      "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters",
  };

  try {
    const response = await fetch(GOOGLE_ROUTES_API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Routes API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No routes found");
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      success: true,
      distanceMeters: leg.distanceMeters,
      distanceMiles: leg.distanceMeters / 1609.34,
      duration: leg.duration,
      polyline: route.polyline?.encodedPolyline,
      origin: origin,
      destination: destination,
    };
  } catch (error) {
    console.error("Routes API error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Convert trip mode to Google Routes API travel mode
 * @param {string} tripMode - Trip mode from the UI
 * @returns {string} Google Routes API travel mode
 */
export const getTravelMode = (tripMode) => {
  switch (tripMode) {
    case "car":
      return "DRIVE";
    case "plane":
      return "DRIVE"; // No flying mode in Routes API, fallback to driving
    case "train":
    case "bus":
      return "TRANSIT";
    case "bike":
      return "BICYCLE";
    case "walk":
      return "WALK";
    default:
      return "DRIVE";
  }
};
