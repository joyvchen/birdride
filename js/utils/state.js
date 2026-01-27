/**
 * BirdRide - Application State Management
 * Simple pub/sub state management for the application
 */

// Application state
const state = {
    // Current page: 'landing' | 'map'
    currentPage: 'landing',

    // Route data
    route: null,
    routeGeoJSON: null,

    // Bird data
    birds: [],
    filteredBirds: [],
    selectedBird: null,

    // Filters
    timeWindow: 14, // 7, 14, 30 days
    distanceFilter: 0.25, // miles from route (0.25, 0.5, 1)
    rarityFilter: 'all', // 'notable' | 'all'

    // UI state
    isLoading: false,
    error: null,
    sidebarExpanded: false,
};

// Subscribers for state changes
const subscribers = new Map();

/**
 * Get current state or a specific key
 */
export function getState(key = null) {
    if (key) {
        return state[key];
    }
    return { ...state };
}

/**
 * Update state and notify subscribers
 */
export function setState(updates) {
    const changedKeys = [];

    for (const [key, value] of Object.entries(updates)) {
        if (state[key] !== value) {
            state[key] = value;
            changedKeys.push(key);
        }
    }

    // Notify subscribers
    for (const key of changedKeys) {
        if (subscribers.has(key)) {
            for (const callback of subscribers.get(key)) {
                callback(state[key], state);
            }
        }
    }

    // Notify global subscribers
    if (changedKeys.length > 0 && subscribers.has('*')) {
        for (const callback of subscribers.get('*')) {
            callback(state, changedKeys);
        }
    }
}

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch, or '*' for all changes
 * @param {Function} callback - Function to call on change
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);

    return () => {
        subscribers.get(key).delete(callback);
    };
}

/**
 * Reset state to initial values
 */
export function resetState() {
    setState({
        currentPage: 'landing',
        route: null,
        routeGeoJSON: null,
        birds: [],
        filteredBirds: [],
        selectedBird: null,
        timeWindow: 14,
        distanceFilter: 0.25,
        rarityFilter: 'all',
        isLoading: false,
        error: null,
        sidebarExpanded: false,
    });
}

/**
 * Apply filters to birds based on current state
 */
export function applyFilters() {
    const birds = state.birds;
    const routeCoords = state.routeGeoJSON;
    const distanceFilter = state.distanceFilter;
    const rarityFilter = state.rarityFilter;

    let filtered = [...birds];

    // Filter by distance from route
    if (routeCoords && routeCoords.length > 0) {
        filtered = filtered.filter(bird => {
            const distanceToRoute = getMinDistanceToRoute(bird.lat, bird.lng, routeCoords);
            return distanceToRoute <= distanceFilter;
        });
    }

    // Filter by rarity
    if (rarityFilter === 'notable') {
        filtered = filtered.filter(bird =>
            bird.rarity === 'rare' || bird.rarity === 'uncommon'
        );
    }

    // Sort by observation date (most recent first)
    filtered.sort((a, b) => {
        const dateA = a.obsDt ? new Date(a.obsDt) : new Date(0);
        const dateB = b.obsDt ? new Date(b.obsDt) : new Date(0);
        return dateB - dateA;
    });

    setState({ filteredBirds: filtered });
}

/**
 * Calculate the minimum distance from a point to the route (in miles)
 * @param {number} lat - Bird latitude
 * @param {number} lng - Bird longitude
 * @param {array} routeCoords - Array of [lat, lng] route coordinates
 * @returns {number} Distance in miles
 */
function getMinDistanceToRoute(lat, lng, routeCoords) {
    let minDistance = Infinity;

    // Check distance to each segment of the route
    for (let i = 0; i < routeCoords.length - 1; i++) {
        const [lat1, lng1] = routeCoords[i];
        const [lat2, lng2] = routeCoords[i + 1];

        // Calculate distance from point to line segment
        const distance = pointToSegmentDistance(lat, lng, lat1, lng1, lat2, lng2);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    // Also check distance to each route point (for single points or endpoints)
    for (const [routeLat, routeLng] of routeCoords) {
        const distance = haversineDistance(lat, lng, routeLat, routeLng);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance;
}

/**
 * Calculate distance from a point to a line segment (in miles)
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
        // Segment is a point
        return haversineDistance(px, py, x1, y1);
    }

    // Calculate projection of point onto line
    const t = Math.max(0, Math.min(1,
        ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    ));

    // Closest point on segment
    const closestLat = x1 + t * dx;
    const closestLng = y1 + t * dy;

    return haversineDistance(px, py, closestLat, closestLng);
}

/**
 * Calculate distance between two points using Haversine formula (in miles)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}
