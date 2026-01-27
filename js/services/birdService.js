/**
 * BirdRide - Bird Service
 * Handles fetching bird sighting data from the backend API
 * and bird photos via backend proxy
 */

// Photo cache - stores photo URLs and credits by species code
const photoCache = new Map();

// Hero image cache - stores hero image data by species code
const heroImageCache = new Map();

/**
 * Fetch recent bird observations near route coordinates
 * @param {array} coordinates - Array of [lat, lng] points along route
 * @param {number} days - Number of days to look back
 * @returns {Promise<array>} Bird observations
 */
export async function fetchRecentBirds(coordinates, days = 14) {
    // Sample points to reduce API load
    const samplePoints = sampleCoordinates(coordinates, 15);

    const response = await fetch('/api/birds?' + new URLSearchParams({
        coords: JSON.stringify(samplePoints),
        days: days,
        radius: 2.5
    }));

    if (!response.ok) {
        throw new Error('Failed to fetch bird data');
    }

    return response.json();
}

/**
 * Sample coordinates evenly along a route
 * @param {array} coordinates - Full route coordinates
 * @param {number} maxPoints - Maximum points to return
 * @returns {array} Sampled coordinates
 */
function sampleCoordinates(coordinates, maxPoints) {
    if (coordinates.length <= maxPoints) {
        return coordinates;
    }

    const step = Math.floor(coordinates.length / maxPoints);
    const sampled = [];

    for (let i = 0; i < coordinates.length; i += step) {
        sampled.push(coordinates[i]);
        if (sampled.length >= maxPoints) break;
    }

    return sampled;
}

/**
 * Extract species code from eBird URL or return as-is if already a code
 * @param {string} input - Either a taxonCode or full eBird species URL
 * @returns {string} Species code
 */
function extractSpeciesCode(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid input: expected species code or eBird URL');
    }

    // Check if input is a URL containing ebird.org/species/
    if (input.includes('ebird.org/species/')) {
        const match = input.match(/ebird\.org\/species\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return match[1];
        }
        throw new Error('Could not extract species code from URL');
    }

    // Validate as species code (alphanumeric)
    if (/^[a-zA-Z0-9]+$/.test(input)) {
        return input;
    }

    throw new Error('Invalid species code format');
}

/**
 * Fetch bird photo via backend proxy (from Macaulay Library)
 * @param {string} speciesCode - eBird species code (e.g., 'baleag')
 * @param {string} comName - Common name for fallback search (e.g., 'American Robin')
 * @returns {Promise<object|null>} Photo data with thumbnail, large, and credit
 */
export async function fetchBirdPhoto(speciesCode, comName = null) {
    // Check cache first
    if (photoCache.has(speciesCode)) {
        return photoCache.get(speciesCode);
    }

    try {
        let url = `/api/photo/${speciesCode}`;
        if (comName) {
            url += `?comName=${encodeURIComponent(comName)}`;
        }
        const response = await fetch(url);

        if (!response.ok) {
            // Fallback to Wikipedia if backend fails
            return fetchWikipediaPhoto(speciesCode, comName);
        }

        const photoData = await response.json();
        photoCache.set(speciesCode, photoData);
        return photoData;
    } catch (error) {
        console.warn(`Error fetching photo for ${speciesCode}:`, error);
        // Fallback to Wikipedia
        return fetchWikipediaPhoto(speciesCode, comName);
    }
}

/**
 * Fallback: Fetch bird photo from Wikipedia
 * @param {string} speciesCode - eBird species code
 * @param {string} comName - Common name for Wikipedia lookup
 * @returns {Promise<object|null>} Photo data
 */
async function fetchWikipediaPhoto(speciesCode, comName = null) {
    // Map common species codes to Wikipedia article titles (legacy fallback)
    const speciesNames = {
        'baleag': 'Bald Eagle',
        'grbher3': 'Great Blue Heron',
        'rethaw': 'Red-tailed Hawk',
        'belkin1': 'Belted Kingfisher',
        'osprey': 'Osprey',
        'amerob': 'American Robin',
        'amecro': 'American Crow',
        'sonspa': 'Song Sparrow',
        'daejun': 'Dark-eyed Junco',
        'bkcchi': 'Black-capped Chickadee',
        'norfli': 'Northern Flicker',
        'mallar3': 'Mallard',
        'cangoo': 'Canada Goose',
        'annhum': 'Anna\'s Hummingbird',
        'spotow': 'Spotted Towhee',
    };

    // Use provided comName, or fall back to hardcoded mapping
    const speciesName = comName || speciesNames[speciesCode];
    if (!speciesName) {
        return getDefaultPhoto();
    }

    try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(speciesName.replace(/ /g, '_'))}`;
        const response = await fetch(url);

        if (!response.ok) {
            return getDefaultPhoto();
        }

        const data = await response.json();

        if (data.thumbnail?.source) {
            const photoData = {
                thumbnail: data.thumbnail.source,
                medium: data.thumbnail.source.replace('/320px-', '/640px-'),
                large: data.originalimage?.source || data.thumbnail.source.replace('/320px-', '/1200px-'),
                credit: 'Wikipedia',
                location: null,
            };
            photoCache.set(speciesCode, photoData);
            return photoData;
        }
    } catch (error) {
        console.warn(`Error fetching Wikipedia photo for ${speciesCode}:`, error);
    }

    return getDefaultPhoto();
}

/**
 * Get default placeholder photo
 */
function getDefaultPhoto() {
    return {
        thumbnail: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text y=".9em" font-size="60" x="20">🐦</text></svg>',
        medium: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text y=".9em" font-size="60" x="20">🐦</text></svg>',
        large: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text y=".9em" font-size="60" x="20">🐦</text></svg>',
        credit: null,
        location: null,
    };
}

/**
 * Get bird photo URL (synchronous, uses cache or returns placeholder)
 * @param {string} speciesName - Common name of the species
 * @param {string} speciesCode - eBird species code (optional)
 * @returns {string} Photo URL
 */
export function getBirdPhotoUrl(speciesName, speciesCode = null) {
    // If we have a cached photo for this species code, use it
    if (speciesCode && photoCache.has(speciesCode)) {
        return photoCache.get(speciesCode).thumbnail;
    }

    // Return placeholder - the actual photo will be loaded asynchronously
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text y=".9em" font-size="60" x="20">🐦</text></svg>';
}

/**
 * Fetch the hero image for a bird species from Macaulay Library
 * Uses quality_desc sort to get the curated hero image (NOT the first "Top Photos" image)
 *
 * @param {string} input - Either a taxonCode (e.g., "eletro1") or
 *                         full eBird species URL (e.g., "https://ebird.org/species/eletro1")
 * @returns {Promise<object>} Hero image data:
 *   Success: { speciesCode: string, assetId: number, imageUrl: string }
 *   Error:   { error: "No media found for species" }
 */
export async function fetchBirdHeroImage(input) {
    let speciesCode;
    try {
        speciesCode = extractSpeciesCode(input);
    } catch (error) {
        console.warn('Invalid input for hero image:', error.message);
        return { error: 'No media found for species' };
    }

    // Check cache first
    if (heroImageCache.has(speciesCode)) {
        return heroImageCache.get(speciesCode);
    }

    try {
        const response = await fetch(`/api/hero-image/${speciesCode}`);

        if (!response.ok) {
            return { error: 'No media found for species' };
        }

        const data = await response.json();

        // Check if response contains an error
        if (data.error) {
            return { error: data.error };
        }

        // Cache successful result
        heroImageCache.set(speciesCode, data);
        return data;

    } catch (error) {
        console.warn(`Error fetching hero image for ${speciesCode}:`, error);
        return { error: 'No media found for species' };
    }
}

/**
 * Get eBird species page URL
 * @param {string} speciesCode - eBird species code
 * @returns {string} eBird species page URL
 */
export function getEBirdSpeciesUrl(speciesCode) {
    return `https://ebird.org/species/${speciesCode}`;
}

/**
 * Determine rarity classification
 * @param {object} observation - Bird observation data
 * @returns {string} 'rare' | 'uncommon' | 'common'
 */
export function classifyRarity(observation) {
    if (observation.rarity) {
        return observation.rarity;
    }
    return 'common';
}

/**
 * Format observation date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatObservationDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Calculate approximate location description along route
 * @param {object} bird - Bird observation with lat/lng
 * @param {array} routeCoordinates - Route coordinates
 * @param {number} totalDistance - Total route distance in meters
 * @returns {string} Location description
 */
export function getLocationDescription(bird, routeCoordinates, totalDistance) {
    // Find closest point on route
    let minDist = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < routeCoordinates.length; i++) {
        const [lat, lng] = routeCoordinates[i];
        const dist = Math.sqrt(
            Math.pow(bird.lat - lat, 2) + Math.pow(bird.lng - lng, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
        }
    }

    // Calculate approximate mile marker
    const progress = closestIndex / routeCoordinates.length;
    const miles = (totalDistance / 1609.344) * progress;

    if (miles < 1) {
        return 'Near start';
    }
    return `Near mile ${Math.round(miles)}`;
}
