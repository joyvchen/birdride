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
    mode: 'recent', // 'recent' | 'expected'
    timeWindow: 14, // 7, 14, 30 days for recent mode
    selectedMonth: new Date().getMonth() + 1, // 1-12 for expected mode
    rarityFilter: 'notable', // 'notable' | 'all'

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
        mode: 'recent',
        timeWindow: 14,
        selectedMonth: new Date().getMonth() + 1,
        rarityFilter: 'notable',
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
    const filter = state.rarityFilter;

    let filtered;
    if (filter === 'notable') {
        filtered = birds.filter(bird =>
            bird.rarity === 'rare' || bird.rarity === 'uncommon'
        );
    } else {
        filtered = [...birds];
    }

    // Sort by rarity (rare first, then uncommon, then common)
    const rarityOrder = { rare: 0, uncommon: 1, common: 2 };
    filtered.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);

    setState({ filteredBirds: filtered });
}
