/**
 * BirdRide - Route History Service
 * LocalStorage-based history service for recently viewed routes
 */

const STORAGE_KEY = 'birdride_route_history';
const MAX_HISTORY = 10;

/**
 * Get route history from localStorage
 * @returns {array} Array of route history objects
 */
export function getRouteHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.warn('Failed to read route history:', error);
        return [];
    }
}

/**
 * Add a route to history
 * @param {object} routeData - Route data with id, name, distance
 */
export function addToHistory(routeData) {
    if (!routeData || !routeData.id) return;

    const history = getRouteHistory();

    // Create history entry
    const entry = {
        id: routeData.id,
        name: routeData.name || `Route ${routeData.id}`,
        distance: routeData.distance || 0,
        timestamp: Date.now()
    };

    // Remove existing entry with same ID (to move it to top)
    const filteredHistory = history.filter(item => item.id !== entry.id);

    // Add new entry at the beginning
    filteredHistory.unshift(entry);

    // Limit to MAX_HISTORY entries
    const trimmedHistory = filteredHistory.slice(0, MAX_HISTORY);

    // Save to localStorage
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory));
    } catch (error) {
        console.warn('Failed to save route history:', error);
    }
}

/**
 * Remove a route from history
 * @param {string|number} routeId - Route ID to remove
 */
export function removeFromHistory(routeId) {
    const history = getRouteHistory();
    const filteredHistory = history.filter(item => item.id !== routeId && item.id !== parseInt(routeId));

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
        console.warn('Failed to update route history:', error);
    }
}

/**
 * Clear all route history
 */
export function clearHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear route history:', error);
    }
}

/**
 * Format timestamp as relative time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted relative time (e.g., "2h ago", "Yesterday")
 */
export function formatHistoryTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) {
        return 'Just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}
