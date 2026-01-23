/**
 * BirdRide - Geocoding Service
 * Handles location search and autocomplete
 */

// Using Nominatim (OpenStreetMap) for geocoding - free and doesn't require API key
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Debounce delay for autocomplete
const DEBOUNCE_MS = 300;

// Cache for geocoding results
const geocodeCache = new Map();

/**
 * Search for locations by query string
 * @param {string} query - Search query (city name, address, etc.)
 * @returns {Promise<array>} List of location suggestions
 */
export async function searchLocations(query) {
    if (!query || query.length < 2) {
        return [];
    }

    // Check cache
    const cacheKey = query.toLowerCase().trim();
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    try {
        const response = await fetch(
            `${NOMINATIM_BASE}/search?` + new URLSearchParams({
                q: query,
                format: 'json',
                addressdetails: 1,
                limit: 5,
                // Bias towards cities/towns for cycling route context
                featuretype: 'city',
            }),
            {
                headers: {
                    'User-Agent': 'BirdRide/1.0 (cycling bird watching app)',
                },
            }
        );

        if (!response.ok) {
            throw new Error('Geocoding request failed');
        }

        const data = await response.json();
        const results = data.map(item => ({
            id: item.place_id,
            name: item.display_name.split(',')[0],
            fullName: formatDisplayName(item),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type,
            country: item.address?.country,
        }));

        // Cache results
        geocodeCache.set(cacheKey, results);

        return results;
    } catch (error) {
        console.error('Geocoding error:', error);
        // Return mock results as fallback
        return getMockLocations(query);
    }
}

/**
 * Create a debounced search function
 * @param {Function} callback - Function to call with results
 * @returns {Function} Debounced search function
 */
export function createDebouncedSearch(callback) {
    let timeoutId = null;

    return (query) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(async () => {
            const results = await searchLocations(query);
            callback(results);
        }, DEBOUNCE_MS);
    };
}

/**
 * Format location display name
 */
function formatDisplayName(item) {
    const parts = [];
    const addr = item.address || {};

    // Primary name
    parts.push(item.display_name.split(',')[0]);

    // State/region if available
    if (addr.state) {
        parts.push(addr.state);
    }

    // Country
    if (addr.country) {
        parts.push(addr.country);
    }

    return parts.join(', ');
}

/**
 * Get mock location results for demo/fallback
 */
function getMockLocations(query) {
    const mockLocations = [
        {
            id: 1,
            name: 'Seattle',
            fullName: 'Seattle, Washington, USA',
            lat: 47.6062,
            lng: -122.3321,
            type: 'city',
            country: 'USA',
        },
        {
            id: 2,
            name: 'San Francisco',
            fullName: 'San Francisco, California, USA',
            lat: 37.7749,
            lng: -122.4194,
            type: 'city',
            country: 'USA',
        },
        {
            id: 3,
            name: 'Portland',
            fullName: 'Portland, Oregon, USA',
            lat: 45.5152,
            lng: -122.6784,
            type: 'city',
            country: 'USA',
        },
        {
            id: 4,
            name: 'Denver',
            fullName: 'Denver, Colorado, USA',
            lat: 39.7392,
            lng: -104.9903,
            type: 'city',
            country: 'USA',
        },
        {
            id: 5,
            name: 'Austin',
            fullName: 'Austin, Texas, USA',
            lat: 30.2672,
            lng: -97.7431,
            type: 'city',
            country: 'USA',
        },
        {
            id: 6,
            name: 'Boulder',
            fullName: 'Boulder, Colorado, USA',
            lat: 40.0150,
            lng: -105.2705,
            type: 'city',
            country: 'USA',
        },
        {
            id: 7,
            name: 'Minneapolis',
            fullName: 'Minneapolis, Minnesota, USA',
            lat: 44.9778,
            lng: -93.2650,
            type: 'city',
            country: 'USA',
        },
        {
            id: 8,
            name: 'Chicago',
            fullName: 'Chicago, Illinois, USA',
            lat: 41.8781,
            lng: -87.6298,
            type: 'city',
            country: 'USA',
        },
        {
            id: 9,
            name: 'New York',
            fullName: 'New York City, New York, USA',
            lat: 40.7128,
            lng: -74.0060,
            type: 'city',
            country: 'USA',
        },
        {
            id: 10,
            name: 'Los Angeles',
            fullName: 'Los Angeles, California, USA',
            lat: 34.0522,
            lng: -118.2437,
            type: 'city',
            country: 'USA',
        },
    ];

    const queryLower = query.toLowerCase();
    return mockLocations.filter(loc =>
        loc.name.toLowerCase().includes(queryLower) ||
        loc.fullName.toLowerCase().includes(queryLower)
    );
}

/**
 * Get coordinates for a well-known city (for demo purposes)
 */
export function getKnownCityCoordinates(cityName) {
    const cities = {
        seattle: { lat: 47.6062, lng: -122.3321 },
        'san francisco': { lat: 37.7749, lng: -122.4194 },
        portland: { lat: 45.5152, lng: -122.6784 },
        denver: { lat: 39.7392, lng: -104.9903 },
        austin: { lat: 30.2672, lng: -97.7431 },
        boulder: { lat: 40.0150, lng: -105.2705 },
        chicago: { lat: 41.8781, lng: -87.6298 },
        'new york': { lat: 40.7128, lng: -74.0060 },
        'los angeles': { lat: 34.0522, lng: -118.2437 },
    };

    return cities[cityName.toLowerCase()] || null;
}
