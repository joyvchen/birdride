/**
 * BirdRide - Route Service
 * Handles integration with RideWithGPS API for route data
 */

// Note: In production, these would call through a backend to protect API keys
// For demo purposes, we'll use mock data and basic fetch where possible

const RIDEWITHGPS_BASE = 'https://ridewithgps.com';

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
 * Fetch route data from RideWithGPS
 * Note: In production, this would go through a backend proxy
 * @param {string} routeId - Route ID
 * @returns {Promise<object>} Route data
 */
export async function fetchRoute(routeId) {
    // In a real implementation, this would call:
    // https://ridewithgps.com/routes/{id}.json
    // or use the RideWithGPS API with authentication

    // For demo, return mock data based on the route ID
    // This simulates the API response structure
    return getMockRoute(routeId);
}

/**
 * Fetch popular routes for a location
 * @param {object} location - { lat, lng, name }
 * @param {number} radius - Search radius in km
 * @returns {Promise<array>} List of popular routes
 */
export async function fetchPopularRoutes(location, radius = 50) {
    // In production, this would call the RideWithGPS search API
    // For demo, return mock popular routes based on location

    return getMockPopularRoutes(location);
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

// ============================================
// Mock Data Functions
// ============================================

function getMockRoute(routeId) {
    // Generate mock route data
    const mockRoutes = {
        // Burke-Gilman Trail
        '12345': {
            id: 12345,
            name: 'Burke-Gilman Trail',
            description: 'Popular paved trail along Lake Washington',
            distance: 32186.9, // meters (20 miles)
            elevation_gain: 152.4, // meters
            first_lat: 47.6528,
            first_lng: -122.3498,
            last_lat: 47.7609,
            last_lng: -122.2676,
            start_location: 'Gas Works Park, Seattle',
            track_points: generateTrailPoints(47.6528, -122.3498, 47.7609, -122.2676, 100),
        },
        // Lake Washington Loop
        '12346': {
            id: 12346,
            name: 'Lake Washington Loop',
            description: 'Classic loop around the lake via I-90 bridge',
            distance: 80467.2, // 50 miles
            elevation_gain: 304.8,
            first_lat: 47.5951,
            first_lng: -122.3292,
            last_lat: 47.5951,
            last_lng: -122.3292,
            start_location: 'Seward Park, Seattle',
            track_points: generateLoopPoints(47.5951, -122.3292, 0.15, 150),
        },
    };

    // Return a specific mock or generate one
    if (mockRoutes[routeId]) {
        return mockRoutes[routeId];
    }

    // Generate a random route for any other ID
    const baseLat = 47.6 + (parseInt(routeId) % 100) * 0.001;
    const baseLng = -122.3 + (parseInt(routeId) % 100) * 0.001;

    return {
        id: parseInt(routeId),
        name: `Route ${routeId}`,
        description: 'A cycling route',
        distance: 20000 + Math.random() * 60000,
        elevation_gain: 100 + Math.random() * 500,
        first_lat: baseLat,
        first_lng: baseLng,
        last_lat: baseLat + 0.05,
        last_lng: baseLng + 0.05,
        start_location: 'Route Start',
        track_points: generateTrailPoints(baseLat, baseLng, baseLat + 0.05, baseLng + 0.05, 50),
    };
}

function getMockPopularRoutes(location) {
    // Return mock popular routes based on location
    const popularRoutesByArea = {
        // Seattle area routes
        seattle: [
            {
                id: '12345',
                name: 'Burke-Gilman Trail',
                description: 'Popular paved trail along Lake Washington',
                distance: 32186.9,
                start_location: 'Gas Works Park',
            },
            {
                id: '12346',
                name: 'Lake Washington Loop',
                description: 'Classic loop around the lake via I-90 bridge',
                distance: 80467.2,
                start_location: 'Seward Park',
            },
            {
                id: '12347',
                name: 'Sammamish River Trail',
                description: 'Flat, scenic trail through wine country',
                distance: 28968.2,
                start_location: 'Bothell',
            },
            {
                id: '12348',
                name: 'Mercer Island Loop',
                description: 'Island circumnavigation with lake views',
                distance: 22530.8,
                start_location: 'Mercer Island Park & Ride',
            },
        ],
        // San Francisco area routes
        sanfrancisco: [
            {
                id: '22345',
                name: 'Golden Gate Bridge Loop',
                description: 'Classic ride across the bridge to Sausalito',
                distance: 24140.2,
                start_location: 'Fisherman\'s Wharf',
            },
            {
                id: '22346',
                name: 'Paradise Loop',
                description: 'Scenic Marin County loop with Bay views',
                distance: 43452.3,
                start_location: 'Mill Valley',
            },
        ],
        // Default routes for other areas
        default: [
            {
                id: '99901',
                name: 'Local Trail',
                description: 'A popular local cycling route',
                distance: 16093.4,
                start_location: 'Trailhead',
            },
            {
                id: '99902',
                name: 'Scenic Loop',
                description: 'A scenic loop through the area',
                distance: 32186.9,
                start_location: 'Park Entrance',
            },
        ],
    };

    // Determine which routes to return based on location name
    const locationLower = location.name?.toLowerCase() || '';

    if (locationLower.includes('seattle') || locationLower.includes('washington')) {
        return popularRoutesByArea.seattle;
    }
    if (locationLower.includes('san francisco') || locationLower.includes('sf')) {
        return popularRoutesByArea.sanfrancisco;
    }

    return popularRoutesByArea.default;
}

function generateTrailPoints(startLat, startLng, endLat, endLng, numPoints) {
    const points = [];

    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        // Add some randomness to make it look like a real trail
        const noise = (Math.random() - 0.5) * 0.005;

        points.push({
            x: startLng + (endLng - startLng) * t + noise,
            y: startLat + (endLat - startLat) * t + noise * 0.5,
            e: 10 + Math.sin(t * Math.PI * 4) * 20 + Math.random() * 10, // elevation
        });
    }

    return points;
}

function generateLoopPoints(centerLat, centerLng, radius, numPoints) {
    const points = [];

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        // Add some variation to make it look natural
        const r = radius * (1 + Math.sin(angle * 3) * 0.1);

        points.push({
            x: centerLng + r * Math.cos(angle) * 1.3, // stretch horizontally
            y: centerLat + r * Math.sin(angle),
            e: 20 + Math.sin(angle * 2) * 30 + Math.random() * 10,
        });
    }

    return points;
}

/**
 * Convert distance in meters to display string
 */
export function formatDistance(meters) {
    const miles = meters / 1609.344;
    return `${Math.round(miles)} mi`;
}
