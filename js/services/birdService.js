/**
 * BirdRide - Bird Service
 * Handles integration with eBird API for bird sighting data
 */

import { config, hasEBirdKey } from '../config.js';

// eBird API configuration
const EBIRD_API_BASE = config.ebird.baseUrl;

// Bird photo sources (using free placeholder images for demo)
// In production, you'd use eBird media or licensed bird photo APIs
const BIRD_PHOTOS = {
    'Bald Eagle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/About_to_Launch_%2826075320352%29.jpg/320px-About_to_Launch_%2826075320352%29.jpg',
    'Great Blue Heron': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Ardea_herodias_-_Great_Blue_Heron.jpg/320px-Ardea_herodias_-_Great_Blue_Heron.jpg',
    'Red-tailed Hawk': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Buteo_jamaicensis_-_Red-tailed_Hawk.jpg/320px-Buteo_jamaicensis_-_Red-tailed_Hawk.jpg',
    'Belted Kingfisher': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Megaceryle_alcyon_-_Belted_Kingfisher.jpg/320px-Megaceryle_alcyon_-_Belted_Kingfisher.jpg',
    'Osprey': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Osprey_-_Pair_at_nest.jpg/320px-Osprey_-_Pair_at_nest.jpg',
    'default': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Eopsaltria_australis_-_Mogo_Campground.jpg/320px-Eopsaltria_australis_-_Mogo_Campground.jpg',
};

/**
 * Fetch recent bird observations near route coordinates
 * @param {array} coordinates - Array of [lat, lng] points along route
 * @param {number} days - Number of days to look back
 * @returns {Promise<array>} Bird observations
 */
export async function fetchRecentBirds(coordinates, days = 14) {
    // Use real API if configured, otherwise use mock data
    if (!hasEBirdKey()) {
        return getMockRecentBirds(coordinates, days);
    }

    // Sample points along the route to query
    const samplePoints = sampleCoordinates(coordinates, config.app.maxSamplePoints || 10);
    const allBirds = new Map(); // Use map to dedupe by species

    // Query eBird for each sample point
    for (const [lat, lng] of samplePoints) {
        try {
            const response = await fetch(
                `${EBIRD_API_BASE}/data/obs/geo/recent?` + new URLSearchParams({
                    lat: lat.toFixed(4),
                    lng: lng.toFixed(4),
                    dist: config.app.searchRadiusKm || 2.5,
                    back: days,
                }),
                {
                    headers: {
                        'X-eBirdApiToken': config.ebird.apiKey,
                    },
                }
            );

            if (!response.ok) {
                console.warn('eBird API error:', response.status);
                continue;
            }

            const birds = await response.json();

            // Process and dedupe birds
            for (const bird of birds) {
                if (!allBirds.has(bird.speciesCode)) {
                    allBirds.set(bird.speciesCode, {
                        speciesCode: bird.speciesCode,
                        comName: bird.comName,
                        sciName: bird.sciName,
                        rarity: bird.obsReviewed ? 'rare' : 'common', // Simplified
                        lat: bird.lat,
                        lng: bird.lng,
                        obsDt: bird.obsDt,
                        howMany: bird.howMany || 1,
                        numObservers: 1, // Not in basic response
                        locName: bird.locName,
                    });
                }
            }
        } catch (error) {
            console.warn('Error fetching birds for point:', error);
        }
    }

    return Array.from(allBirds.values());
}

/**
 * Fetch notable (rare) bird observations near route coordinates
 * @param {array} coordinates - Array of [lat, lng] points along route
 * @param {number} days - Number of days to look back
 * @returns {Promise<array>} Notable bird observations
 */
export async function fetchNotableBirds(coordinates, days = 14) {
    // In production, this would call:
    // GET /v2/data/obs/geo/recent/notable?lat={lat}&lng={lng}&dist={km}&back={days}

    return getMockRecentBirds(coordinates, days).then(birds =>
        birds.filter(b => b.rarity === 'rare' || b.rarity === 'uncommon')
    );
}

/**
 * Fetch expected birds for a location by month
 * @param {array} coordinates - Array of [lat, lng] points along route
 * @param {number} month - Month number (1-12)
 * @returns {Promise<array>} Expected birds with frequency data
 */
export async function fetchExpectedBirds(coordinates, month) {
    // Note: eBird's frequency/bar chart data requires region codes,
    // which would need a separate geocoding step. For now, we use
    // the recent notable observations as a proxy, or fall back to mock data.

    if (!hasEBirdKey()) {
        return getMockExpectedBirds(coordinates, month);
    }

    // For real implementation, you would:
    // 1. Get the region code for the route area (e.g., "US-WA-033")
    // 2. Call /v2/product/spplist/{regionCode} for species list
    // 3. Call /v2/product/checklist/view/{subId} for frequency data
    // For now, return notable birds from the area as "expected rare birds"

    const [lat, lng] = coordinates[Math.floor(coordinates.length / 2)];

    try {
        const response = await fetch(
            `${EBIRD_API_BASE}/data/obs/geo/recent/notable?` + new URLSearchParams({
                lat: lat.toFixed(4),
                lng: lng.toFixed(4),
                dist: 25, // Wider radius for expected birds
                back: 30,
            }),
            {
                headers: {
                    'X-eBirdApiToken': config.ebird.apiKey,
                },
            }
        );

        if (!response.ok) {
            return getMockExpectedBirds(coordinates, month);
        }

        const birds = await response.json();
        const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        return birds.slice(0, 20).map(bird => ({
            speciesCode: bird.speciesCode,
            comName: bird.comName,
            sciName: bird.sciName,
            rarity: 'rare',
            lat: bird.lat,
            lng: bird.lng,
            frequency: 'Sometimes seen',
            expectedIn: monthNames[month],
            habitat: 'Various habitats',
            isExpected: true,
        }));
    } catch (error) {
        console.warn('Error fetching expected birds:', error);
        return getMockExpectedBirds(coordinates, month);
    }
}

/**
 * Sample coordinates along a route
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
 * Get bird photo URL
 * @param {string} speciesName - Common name of the species
 * @returns {string} Photo URL
 */
export function getBirdPhotoUrl(speciesName) {
    return BIRD_PHOTOS[speciesName] || BIRD_PHOTOS['default'];
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
    // eBird provides rarity flags and frequency data
    // This is a simplified classification
    if (observation.isNotable || observation.frequency < 0.01) {
        return 'rare';
    }
    if (observation.frequency < 0.1) {
        return 'uncommon';
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

// ============================================
// Mock Data Functions
// ============================================

async function getMockRecentBirds(coordinates, days) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const now = new Date();
    const mockBirds = [
        {
            speciesCode: 'baleag',
            comName: 'Bald Eagle',
            sciName: 'Haliaeetus leucocephalus',
            rarity: 'rare',
            lat: coordinates[0][0] + (Math.random() - 0.5) * 0.02,
            lng: coordinates[0][1] + (Math.random() - 0.5) * 0.02,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: 2,
            numObservers: 3,
            locName: 'Lake viewpoint',
        },
        {
            speciesCode: 'grbher3',
            comName: 'Great Blue Heron',
            sciName: 'Ardea herodias',
            rarity: 'uncommon',
            lat: coordinates[Math.floor(coordinates.length * 0.3)][0] + (Math.random() - 0.5) * 0.01,
            lng: coordinates[Math.floor(coordinates.length * 0.3)][1] + (Math.random() - 0.5) * 0.01,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: 1,
            numObservers: 5,
            locName: 'Wetland area',
        },
        {
            speciesCode: 'rethaw',
            comName: 'Red-tailed Hawk',
            sciName: 'Buteo jamaicensis',
            rarity: 'common',
            lat: coordinates[Math.floor(coordinates.length * 0.5)][0] + (Math.random() - 0.5) * 0.01,
            lng: coordinates[Math.floor(coordinates.length * 0.5)][1] + (Math.random() - 0.5) * 0.01,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: 1,
            numObservers: 8,
            locName: 'Open field',
        },
        {
            speciesCode: 'belkin1',
            comName: 'Belted Kingfisher',
            sciName: 'Megaceryle alcyon',
            rarity: 'uncommon',
            lat: coordinates[Math.floor(coordinates.length * 0.7)][0] + (Math.random() - 0.5) * 0.01,
            lng: coordinates[Math.floor(coordinates.length * 0.7)][1] + (Math.random() - 0.5) * 0.01,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: 1,
            numObservers: 2,
            locName: 'Creek crossing',
        },
        {
            speciesCode: 'osprey',
            comName: 'Osprey',
            sciName: 'Pandion haliaetus',
            rarity: 'rare',
            lat: coordinates[Math.floor(coordinates.length * 0.9)][0] + (Math.random() - 0.5) * 0.02,
            lng: coordinates[Math.floor(coordinates.length * 0.9)][1] + (Math.random() - 0.5) * 0.02,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: 1,
            numObservers: 4,
            locName: 'Near fishing pier',
        },
    ];

    // Add some common birds
    const commonBirds = [
        { name: 'American Robin', sci: 'Turdus migratorius', code: 'amerob' },
        { name: 'American Crow', sci: 'Corvus brachyrhynchos', code: 'amecro' },
        { name: 'Song Sparrow', sci: 'Melospiza melodia', code: 'sonspa' },
        { name: 'Dark-eyed Junco', sci: 'Junco hyemalis', code: 'daejun' },
        { name: 'Black-capped Chickadee', sci: 'Poecile atricapillus', code: 'bkcchi' },
        { name: 'Northern Flicker', sci: 'Colaptes auratus', code: 'norfli' },
        { name: 'Mallard', sci: 'Anas platyrhynchos', code: 'mallar3' },
        { name: 'Canada Goose', sci: 'Branta canadensis', code: 'cangoo' },
        { name: 'Anna\'s Hummingbird', sci: 'Calypte anna', code: 'annhum' },
        { name: 'Spotted Towhee', sci: 'Pipilo maculatus', code: 'spotow' },
    ];

    for (let i = 0; i < commonBirds.length; i++) {
        const bird = commonBirds[i];
        const coordIdx = Math.floor(Math.random() * coordinates.length);

        mockBirds.push({
            speciesCode: bird.code,
            comName: bird.name,
            sciName: bird.sci,
            rarity: 'common',
            lat: coordinates[coordIdx][0] + (Math.random() - 0.5) * 0.01,
            lng: coordinates[coordIdx][1] + (Math.random() - 0.5) * 0.01,
            obsDt: new Date(now - Math.random() * days * 24 * 60 * 60 * 1000).toISOString(),
            howMany: Math.floor(Math.random() * 10) + 1,
            numObservers: Math.floor(Math.random() * 15) + 1,
            locName: 'Along trail',
        });
    }

    return mockBirds;
}

async function getMockExpectedBirds(coordinates, month) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const monthNames = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Seasonal bird data - varies by month
    const seasonalBirds = {
        winter: [
            { name: 'Bald Eagle', sci: 'Haliaeetus leucocephalus', code: 'baleag', rarity: 'rare', frequency: 'Usually present', habitat: 'lakes, tall trees' },
            { name: 'Dark-eyed Junco', sci: 'Junco hyemalis', code: 'daejun', rarity: 'common', frequency: 'Usually present', habitat: 'brushy areas, feeders' },
            { name: 'Golden-crowned Kinglet', sci: 'Regulus satrapa', code: 'gockin', rarity: 'uncommon', frequency: 'Sometimes seen', habitat: 'conifer forests' },
        ],
        spring: [
            { name: 'Osprey', sci: 'Pandion haliaetus', code: 'osprey', rarity: 'rare', frequency: 'Usually present', habitat: 'near water with fish' },
            { name: 'Rufous Hummingbird', sci: 'Selasphorus rufus', code: 'rufhum', rarity: 'uncommon', frequency: 'Usually present', habitat: 'gardens, forest edges' },
            { name: 'Yellow-rumped Warbler', sci: 'Setophaga coronata', code: 'yerwar', rarity: 'common', frequency: 'Usually present', habitat: 'forests, shrubs' },
        ],
        summer: [
            { name: 'Western Tanager', sci: 'Piranga ludoviciana', code: 'westan', rarity: 'uncommon', frequency: 'Sometimes seen', habitat: 'conifer and mixed forests' },
            { name: 'Swainson\'s Thrush', sci: 'Catharus ustulatus', code: 'swathr', rarity: 'uncommon', frequency: 'Usually present', habitat: 'dense understory' },
            { name: 'Cedar Waxwing', sci: 'Bombycilla cedrorum', code: 'cedwax', rarity: 'common', frequency: 'Usually present', habitat: 'berry-producing trees' },
        ],
        fall: [
            { name: 'American Wigeon', sci: 'Mareca americana', code: 'amewig', rarity: 'uncommon', frequency: 'Usually present', habitat: 'lakes, ponds' },
            { name: 'Greater White-fronted Goose', sci: 'Anser albifrons', code: 'gwfgoo', rarity: 'rare', frequency: 'Rare visitor', habitat: 'fields, wetlands' },
            { name: 'Ruby-crowned Kinglet', sci: 'Regulus calendula', code: 'ruckin', rarity: 'common', frequency: 'Usually present', habitat: 'forests, thickets' },
        ],
    };

    // Determine season from month
    let season;
    if (month >= 3 && month <= 5) season = 'spring';
    else if (month >= 6 && month <= 8) season = 'summer';
    else if (month >= 9 && month <= 11) season = 'fall';
    else season = 'winter';

    // Year-round residents
    const yearRound = [
        { name: 'American Robin', sci: 'Turdus migratorius', code: 'amerob', rarity: 'common', frequency: 'Usually present', habitat: 'lawns, parks' },
        { name: 'American Crow', sci: 'Corvus brachyrhynchos', code: 'amecro', rarity: 'common', frequency: 'Usually present', habitat: 'everywhere' },
        { name: 'Song Sparrow', sci: 'Melospiza melodia', code: 'sonspa', rarity: 'common', frequency: 'Usually present', habitat: 'brushy areas' },
        { name: 'Black-capped Chickadee', sci: 'Poecile atricapillus', code: 'bkcchi', rarity: 'common', frequency: 'Usually present', habitat: 'forests, feeders' },
        { name: 'Spotted Towhee', sci: 'Pipilo maculatus', code: 'spotow', rarity: 'common', frequency: 'Usually present', habitat: 'dense brush' },
        { name: 'Great Blue Heron', sci: 'Ardea herodias', code: 'grbher3', rarity: 'uncommon', frequency: 'Usually present', habitat: 'wetlands, shorelines' },
        { name: 'Red-tailed Hawk', sci: 'Buteo jamaicensis', code: 'rethaw', rarity: 'common', frequency: 'Usually present', habitat: 'open areas' },
        { name: 'Belted Kingfisher', sci: 'Megaceryle alcyon', code: 'belkin1', rarity: 'uncommon', frequency: 'Sometimes seen', habitat: 'streams, lakes' },
    ];

    // Combine seasonal and year-round birds
    const allBirds = [...seasonalBirds[season], ...yearRound];

    // Add location data
    return allBirds.map((bird, i) => {
        const coordIdx = Math.floor((i / allBirds.length) * coordinates.length);
        return {
            ...bird,
            speciesCode: bird.code,
            comName: bird.name,
            sciName: bird.sci,
            lat: coordinates[coordIdx][0] + (Math.random() - 0.5) * 0.01,
            lng: coordinates[coordIdx][1] + (Math.random() - 0.5) * 0.01,
            expectedIn: monthNames[month],
            isExpected: true,
        };
    });
}
