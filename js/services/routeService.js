/**
 * BirdRide - Route Service
 * Handles fetching route data from the backend API
 */

/**
 * Parse a RideWithGPS URL to extract route ID
 * @param {string} url - RideWithGPS URL
 * @returns {object|null} { type: 'route'|'trip', id: string } or null if invalid
 */
export function parseRideWithGPSUrl(url) {
    const patterns = [
        // Route URLs
        /ridewithgps\.com\/routes\/(\d+)/i,
        // Trip URLs
        /ridewithgps\.com\/trips\/(\d+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            const isTrip = url.includes('/trips/');
            return {
                type: isTrip ? 'trip' : 'route',
                id: match[1],
            };
        }
    }

    return null;
}

/**
 * Validate if a string looks like a RideWithGPS URL
 */
export function isRideWithGPSUrl(input) {
    return input.includes('ridewithgps.com');
}

/**
 * Fetch route data from backend API
 * @param {string} routeId - Route ID
 * @returns {Promise<object>} Route data
 */
export async function fetchRoute(routeId) {
    const response = await fetch(`/api/route/${routeId}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Route fetch failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Extract route coordinates for mapping
 * @param {object} routeData - Route data from API
 * @returns {array} Array of [lat, lng] coordinates
 */
export function extractRouteCoordinates(routeData) {
    if (routeData.track_points) {
        return routeData.track_points.map(pt => [pt.y, pt.x]);
    }
    if (routeData.coordinates) {
        return routeData.coordinates;
    }
    return [];
}

/**
 * Calculate route bounds for map fitting
 * @param {array} coordinates - Route coordinates
 * @returns {object} { north, south, east, west }
 */
export function calculateRouteBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return null;
    }

    let north = -90, south = 90, east = -180, west = 180;

    for (const [lat, lng] of coordinates) {
        north = Math.max(north, lat);
        south = Math.min(south, lat);
        east = Math.max(east, lng);
        west = Math.min(west, lng);
    }

    return { north, south, east, west };
}

/**
 * Sample points along a route for bird data queries
 * @param {array} coordinates - Route coordinates
 * @param {number} maxPoints - Maximum number of sample points
 * @returns {array} Sampled coordinates
 */
export function sampleRoutePoints(coordinates, maxPoints = 10) {
    if (coordinates.length <= maxPoints) {
        return coordinates;
    }

    const step = Math.floor(coordinates.length / maxPoints);
    const sampled = [];

    for (let i = 0; i < coordinates.length; i += step) {
        sampled.push(coordinates[i]);
    }

    // Always include the last point
    if (sampled[sampled.length - 1] !== coordinates[coordinates.length - 1]) {
        sampled.push(coordinates[coordinates.length - 1]);
    }

    return sampled;
}

/**
 * Convert distance in meters to display string
 */
export function formatDistance(meters) {
    const miles = meters / 1609.344;
    return `${Math.round(miles)} mi`;
}
