/**
 * BirdRide - Backend Server
 * Simple Express server to proxy API requests and serve static files
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// eBird API key (set via environment variable)
const EBIRD_API_KEY = process.env.EBIRD_API_KEY || 'dbvvrg1t1p62';

// Serve static files
app.use(express.static(path.join(__dirname)));

// Parse JSON bodies
app.use(express.json());

/**
 * Proxy RideWithGPS route data
 * GET /api/route/:id
 */
app.get('/api/route/:id', async (req, res) => {
    const routeId = req.params.id;
    const url = `https://ridewithgps.com/routes/${routeId}.json`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'BirdRide/1.0'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Route not found',
                status: response.status
            });
        }

        const data = await response.json();
        const routeData = data.route || data;

        // Normalize the route data
        const normalized = {
            id: routeData.id || parseInt(routeId),
            name: routeData.name || `Route ${routeId}`,
            description: routeData.description || '',
            distance: routeData.distance || 0,
            elevation_gain: routeData.elevation_gain || 0,
            elevation_loss: routeData.elevation_loss || 0,
            first_lat: routeData.first_lat || routeData.track_points?.[0]?.y,
            first_lng: routeData.first_lng || routeData.track_points?.[0]?.x,
            last_lat: routeData.last_lat || routeData.track_points?.[routeData.track_points?.length - 1]?.y,
            last_lng: routeData.last_lng || routeData.track_points?.[routeData.track_points?.length - 1]?.x,
            start_location: routeData.locality || routeData.administrative_area || 'Route Start',
            track_points: routeData.track_points || []
        };

        res.json(normalized);
    } catch (error) {
        console.error('Error fetching route:', error.message);
        res.status(500).json({ error: 'Failed to fetch route data' });
    }
});

/**
 * Proxy eBird bird sightings data
 * GET /api/birds?coords=[[lat,lng],...]&days=14&radius=2.5
 */
app.get('/api/birds', async (req, res) => {
    try {
        const coords = JSON.parse(req.query.coords || '[]');
        const days = parseInt(req.query.days) || 14;
        const radius = parseFloat(req.query.radius) || 2.5;

        if (!coords.length) {
            return res.status(400).json({ error: 'No coordinates provided' });
        }

        // Sample up to 15 points along the route
        const samplePoints = sampleCoordinates(coords, 15);
        const allBirds = new Map();
        const seenSightings = new Set(); // Track unique sightings by speciesCode + subId

        // Fetch notable species for all sample points in parallel
        const notablePromises = samplePoints.map(([lat, lng]) =>
            fetchNotableBirds(lat, lng, days, radius)
        );
        const notableResults = await Promise.allSettled(notablePromises);

        // Build Set of notable species codes AND add notable observations to results
        const notableSpecies = new Set();
        for (const result of notableResults) {
            if (result.status === 'fulfilled') {
                for (const bird of result.value) {
                    notableSpecies.add(bird.speciesCode);

                    // Add notable observation directly to results (they may not appear in regular /recent endpoint)
                    const sightingKey = `${bird.speciesCode}-${bird.subId}`;
                    if (!seenSightings.has(sightingKey)) {
                        seenSightings.add(sightingKey);

                        const sighting = {
                            obsDt: bird.obsDt,
                            howMany: bird.howMany || 1,
                            locName: bird.locName,
                            subId: bird.subId,
                            lat: bird.lat,
                            lng: bird.lng
                        };

                        if (!allBirds.has(bird.speciesCode)) {
                            allBirds.set(bird.speciesCode, {
                                speciesCode: bird.speciesCode,
                                comName: bird.comName,
                                sciName: bird.sciName,
                                rarity: 'rare', // Notable birds are always rare
                                lat: bird.lat,
                                lng: bird.lng,
                                obsDt: bird.obsDt,
                                howMany: bird.howMany || 1,
                                locName: bird.locName,
                                subId: bird.subId,
                                sightings: [sighting]
                            });
                        } else {
                            // Add to existing species' sightings
                            const existing = allBirds.get(bird.speciesCode);
                            existing.sightings.push(sighting);
                            // Ensure it's marked as rare since it appeared in notable
                            existing.rarity = 'rare';
                        }
                    }
                }
            }
        }

        console.log(`[Notable] Total unique notable species: ${notableSpecies.size}`);
        console.log(`[Notable] Added ${allBirds.size} notable birds to results`);
        if (notableSpecies.size > 0) {
            console.log(`[Notable] Species codes: ${[...notableSpecies].slice(0, 10).join(', ')}${notableSpecies.size > 10 ? '...' : ''}`);
        }

        // Query eBird for each sample point
        for (const [lat, lng] of samplePoints) {
            try {
                const url = `https://api.ebird.org/v2/data/obs/geo/recent?` +
                    new URLSearchParams({
                        lat: lat.toFixed(4),
                        lng: lng.toFixed(4),
                        dist: radius,
                        back: days
                    });

                const response = await fetch(url, {
                    headers: {
                        'X-eBirdApiToken': EBIRD_API_KEY
                    }
                });

                if (!response.ok) {
                    console.warn(`eBird API error for point [${lat}, ${lng}]:`, response.status);
                    continue;
                }

                const birds = await response.json();

                // Group by species code, collecting all sightings
                for (const bird of birds) {
                    // Create unique key for this sighting to prevent duplicates
                    const sightingKey = `${bird.speciesCode}-${bird.subId}`;

                    if (seenSightings.has(sightingKey)) {
                        continue; // Skip duplicate sighting from overlapping sample points
                    }
                    seenSightings.add(sightingKey);

                    const sighting = {
                        obsDt: bird.obsDt,
                        howMany: bird.howMany || 1,
                        locName: bird.locName,
                        subId: bird.subId,
                        lat: bird.lat,
                        lng: bird.lng
                    };

                    if (!allBirds.has(bird.speciesCode)) {
                        allBirds.set(bird.speciesCode, {
                            speciesCode: bird.speciesCode,
                            comName: bird.comName,
                            sciName: bird.sciName,
                            // Both notable species (Rare Bird Alert) AND obsReviewed are marked as 'rare' (Notable)
                            rarity: (notableSpecies.has(bird.speciesCode) || bird.obsReviewed) ? 'rare' : 'common',
                            lat: bird.lat,
                            lng: bird.lng,
                            obsDt: bird.obsDt,
                            howMany: bird.howMany || 1,
                            locName: bird.locName,
                            subId: bird.subId,
                            sightings: [sighting]
                        });
                    } else {
                        // Add to existing species' sightings
                        const existing = allBirds.get(bird.speciesCode);
                        existing.sightings.push(sighting);

                        // Update primary data if this sighting is more recent
                        if (bird.obsDt > existing.obsDt) {
                            existing.obsDt = bird.obsDt;
                            existing.lat = bird.lat;
                            existing.lng = bird.lng;
                            existing.howMany = bird.howMany || 1;
                            existing.locName = bird.locName;
                            existing.subId = bird.subId;
                        }
                    }
                }
            } catch (err) {
                console.warn('Error fetching birds for point:', err.message);
            }
        }

        // Sort sightings within each species by date (most recent first)
        for (const bird of allBirds.values()) {
            bird.sightings.sort((a, b) => new Date(b.obsDt) - new Date(a.obsDt));
        }

        res.json(Array.from(allBirds.values()));
    } catch (error) {
        console.error('Error fetching bird data:', error.message);
        res.status(500).json({ error: 'Failed to fetch bird data' });
    }
});

/**
 * Fetch notable bird species from eBird API
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} days - Number of days to look back
 * @param {number} radius - Search radius in km
 * @returns {Promise<Array>} Notable bird observations
 */
async function fetchNotableBirds(lat, lng, days, radius) {
    try {
        const url = `https://api.ebird.org/v2/data/obs/geo/recent/notable?` +
            new URLSearchParams({
                lat: lat.toFixed(4),
                lng: lng.toFixed(4),
                dist: radius,
                back: days
            });

        console.log(`[Notable] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: { 'X-eBirdApiToken': EBIRD_API_KEY }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.warn(`[Notable] API error for [${lat}, ${lng}]: ${response.status} - ${errorBody}`);
            return [];
        }

        const data = await response.json();
        console.log(`[Notable] Found ${data.length} notable observations at [${lat}, ${lng}]`);
        return data;
    } catch (err) {
        console.warn('[Notable] Error fetching notable birds:', err.message);
        return [];
    }
}

/**
 * Search Macaulay Library by taxon code
 * @param {string} speciesCode - eBird species code
 * @returns {Promise<object|null>} Photo data or null
 */
async function searchMacaulayByTaxon(speciesCode) {
    const url = `https://search.macaulaylibrary.org/api/v1/search?` +
        new URLSearchParams({
            taxonCode: speciesCode,
            mediaType: 'photo',
            sort: 'rating_rank_desc',
            count: 1
        });

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'BirdRide/1.0 (Bird watching route app)',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        console.warn(`Macaulay API error for ${speciesCode}: ${response.status}`);
        return null;
    }

    const data = await response.json();
    if (data.results?.content?.length > 0) {
        const photo = data.results.content[0];
        return {
            thumbnail: `${photo.previewUrl}160`,
            medium: `${photo.previewUrl}640`,
            large: photo.largeUrl || `${photo.previewUrl}1200`,
            credit: photo.userDisplayName || 'Unknown'
        };
    }
    return null;
}

/**
 * Search Macaulay Library by common name
 * @param {string} comName - Bird common name
 * @returns {Promise<object|null>} Photo data or null
 */
async function searchMacaulayByName(comName) {
    const url = `https://search.macaulaylibrary.org/api/v1/search?` +
        new URLSearchParams({
            q: comName,
            mediaType: 'photo',
            sort: 'rating_rank_desc',
            count: 1
        });

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'BirdRide/1.0 (Bird watching route app)',
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        console.warn(`Macaulay API error for name "${comName}": ${response.status}`);
        return null;
    }

    const data = await response.json();
    if (data.results?.content?.length > 0) {
        const photo = data.results.content[0];
        return {
            thumbnail: `${photo.previewUrl}160`,
            medium: `${photo.previewUrl}640`,
            large: photo.largeUrl || `${photo.previewUrl}1200`,
            credit: photo.userDisplayName || 'Unknown'
        };
    }
    return null;
}

/**
 * Proxy bird photo requests from Macaulay Library
 * GET /api/photo/:speciesCode?comName=...
 */
app.get('/api/photo/:speciesCode', async (req, res) => {
    const speciesCode = req.params.speciesCode;
    const comName = req.query.comName;

    try {
        // Try taxonCode first
        let photoData = await searchMacaulayByTaxon(speciesCode);

        // Fallback: search by common name
        if (!photoData && comName) {
            photoData = await searchMacaulayByName(comName);
        }

        if (photoData) {
            return res.json(photoData);
        }
        res.status(404).json({ error: 'No photo found' });
    } catch (error) {
        console.error('Error fetching photo:', error.message);
        res.status(500).json({ error: 'Failed to fetch photo' });
    }
});

/**
 * Fetch hero image for a bird species from Macaulay Library catalog
 * Uses quality_desc sort to get the curated hero image
 * Falls back to rating_rank_desc (Top Photos) if no hero image found
 * GET /api/hero-image/:speciesCode
 */
app.get('/api/hero-image/:speciesCode', async (req, res) => {
    const speciesCode = req.params.speciesCode;

    try {
        // Try catalog API with quality_desc sort (curated hero image)
        const catalogUrl = `https://search.macaulaylibrary.org/catalog?` +
            new URLSearchParams({
                taxonCode: speciesCode,
                mediaType: 'photo',
                sort: 'quality_desc',
                limit: '1'
            });

        const catalogResponse = await fetch(catalogUrl, {
            headers: {
                'User-Agent': 'BirdRide/1.0 (Bird watching route app)',
                'Accept': 'application/json'
            }
        });

        if (catalogResponse.ok) {
            const data = await catalogResponse.json();
            const results = data.results?.content || data.results || [];

            if (results.length > 0 && results[0].assetId) {
                const assetId = results[0].assetId;
                return res.json({
                    speciesCode: speciesCode,
                    assetId: assetId,
                    imageUrl: `https://macaulaylibrary.org/asset/${assetId}`,
                    thumbnail: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/320`,
                    medium: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/640`,
                    large: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/1200`,
                    credit: results[0].userDisplayName || 'Unknown'
                });
            }
        }

        // Fallback: Use existing searchMacaulayByTaxon (Top Photos, rating_rank_desc)
        const fallbackPhoto = await searchMacaulayByTaxon(speciesCode);
        if (fallbackPhoto) {
            // Extract assetId from the large URL or previewUrl
            // URL format: https://cdn.download.ams.birds.cornell.edu/api/v1/asset/{assetId}/...
            const assetMatch = fallbackPhoto.large?.match(/\/asset\/(\d+)/) ||
                               fallbackPhoto.thumbnail?.match(/\/asset\/(\d+)/);
            if (assetMatch) {
                const assetId = assetMatch[1];
                return res.json({
                    speciesCode: speciesCode,
                    assetId: parseInt(assetId),
                    imageUrl: `https://macaulaylibrary.org/asset/${assetId}`,
                    thumbnail: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/320`,
                    medium: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/640`,
                    large: `https://cdn.download.ams.birds.cornell.edu/api/v2/asset/${assetId}/1200`,
                    credit: fallbackPhoto.credit || 'Unknown'
                });
            }
        }

        res.json({ error: 'No media found for species' });

    } catch (error) {
        console.error('Error fetching hero image:', error.message);
        res.json({ error: 'No media found for species' });
    }
});

/**
 * Geocode a location using OpenStreetMap Nominatim API
 * GET /api/geocode?q=Seattle
 */
app.get('/api/geocode', async (req, res) => {
    const query = req.query.q;

    if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: 'Query too short' });
    }

    try {
        const url = `https://nominatim.openstreetmap.org/search?` +
            new URLSearchParams({
                q: query,
                format: 'json',
                limit: 5,
                countrycodes: 'us'
            });

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BirdRide/1.0 (Bird watching route app)'
            }
        });

        if (!response.ok) {
            console.warn('Nominatim API error:', response.status);
            return res.status(500).json({ error: 'Geocoding failed' });
        }

        const data = await response.json();

        const results = data.map(item => ({
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            displayName: item.display_name,
            type: item.type,
            importance: item.importance
        }));

        res.json(results);
    } catch (error) {
        console.error('Geocoding error:', error.message);
        res.status(500).json({ error: 'Geocoding failed' });
    }
});

/**
 * Region slug mapping for major US cities
 */
const REGION_SLUGS = {
    // West Coast
    'seattle': '3-seattle-washington-usa',
    'portland': '1-portland-oregon-usa',
    'san francisco': '17-san-francisco-california-usa',
    'los angeles': '38-los-angeles-california-usa',
    'san diego': '16-san-diego-california-usa',
    'san jose': '85-san-jose-california-usa',
    'bend': '18-bend-oregon-usa',
    // Mountain
    'denver': '4-denver-colorado-usa',
    'salt lake city': '58-salt-lake-city-utah-usa',
    'phoenix': '68-phoenix-arizona-usa',
    'tucson': '24-tucson-arizona-usa',
    'boulder': '57-boulder-colorado-usa',
    'fort collins': '56-fort-collins-colorado-usa',
    'boise': '61-boise-idaho-usa',
    'santa fe': '40-santa-fe-new-mexico-usa',
    // Midwest
    'chicago': '9-chicago-illinois-usa',
    'minneapolis': '10-minneapolis-minnesota-usa',
    'madison': '11-madison-wisconsin-usa',
    'indianapolis': '12-indianapolis-indiana-usa',
    'columbus': '54-columbus-ohio-usa',
    'cleveland': '79-cleveland-ohio-usa',
    'grand rapids': '64-grand-rapids-michigan-usa',
    'kansas city': '63-kansas-city-usa',
    'st louis': '74-st-louis-missouri-usa',
    // South
    'austin': '19-austin-texas-usa',
    'houston': '20-houston-texas-usa',
    'dallas': '21-dallas-texas-usa',
    'san antonio': '69-san-antonio-texas-usa',
    'atlanta': '60-atlanta-georgia-usa',
    'tampa': '23-tampa-florida-usa',
    'knoxville': '65-knoxville-tennessee-usa',
    'louisville': '13-louisville-kentucky-usa',
    'asheville': '8-asheville-north-carolina-usa',
    'raleigh': '35-raleigh-durham-north-carolina-usa',
    'little rock': '43-little-rock-arkansas-usa',
    'fayetteville': '36-fayetteville-arkansas-usa',
    // East Coast
    'new york': '5-new-york-city-new-york-usa',
    'boston': '6-boston-massachusetts-usa',
    'philadelphia': '7-philadelphia-pennsylvania-usa',
    'washington': '2-washington-dc-usa',
    'pittsburgh': '70-pittsburgh-pennsylvania-usa',
    'providence': '52-providence-rhode-island-usa',
    'roanoke': '55-roanoke-virginia-usa',
    // Other
    'honolulu': '77-hawaii-hawaii-usa'
};

/**
 * Find the closest region slug for given coordinates
 */
function findClosestRegion(lat, lng) {
    // Major city coordinates
    const CITY_COORDS = {
        // West Coast
        'seattle': { lat: 47.6062, lng: -122.3321 },
        'portland': { lat: 45.5152, lng: -122.6784 },
        'san francisco': { lat: 37.7749, lng: -122.4194 },
        'los angeles': { lat: 34.0522, lng: -118.2437 },
        'san diego': { lat: 32.7157, lng: -117.1611 },
        'san jose': { lat: 37.3382, lng: -121.8863 },
        'bend': { lat: 44.0582, lng: -121.3153 },
        // Mountain
        'denver': { lat: 39.7392, lng: -104.9903 },
        'salt lake city': { lat: 40.7608, lng: -111.8910 },
        'phoenix': { lat: 33.4484, lng: -112.0740 },
        'tucson': { lat: 32.2226, lng: -110.9747 },
        'boulder': { lat: 40.0150, lng: -105.2705 },
        'fort collins': { lat: 40.5853, lng: -105.0844 },
        'boise': { lat: 43.6150, lng: -116.2023 },
        'santa fe': { lat: 35.6870, lng: -105.9378 },
        // Midwest
        'chicago': { lat: 41.8781, lng: -87.6298 },
        'minneapolis': { lat: 44.9778, lng: -93.2650 },
        'madison': { lat: 43.0731, lng: -89.4012 },
        'indianapolis': { lat: 39.7684, lng: -86.1581 },
        'columbus': { lat: 39.9612, lng: -82.9988 },
        'cleveland': { lat: 41.4993, lng: -81.6944 },
        'grand rapids': { lat: 42.9634, lng: -85.6681 },
        'kansas city': { lat: 39.0997, lng: -94.5786 },
        'st louis': { lat: 38.6270, lng: -90.1994 },
        // South
        'austin': { lat: 30.2672, lng: -97.7431 },
        'houston': { lat: 29.7604, lng: -95.3698 },
        'dallas': { lat: 32.7767, lng: -96.7970 },
        'san antonio': { lat: 29.4241, lng: -98.4936 },
        'atlanta': { lat: 33.7490, lng: -84.3880 },
        'tampa': { lat: 27.9506, lng: -82.4572 },
        'knoxville': { lat: 35.9606, lng: -83.9207 },
        'louisville': { lat: 38.2527, lng: -85.7585 },
        'asheville': { lat: 35.5951, lng: -82.5515 },
        'raleigh': { lat: 35.7796, lng: -78.6382 },
        'little rock': { lat: 34.7465, lng: -92.2896 },
        'fayetteville': { lat: 36.0626, lng: -94.1574 },
        // East Coast
        'new york': { lat: 40.7128, lng: -74.0060 },
        'boston': { lat: 42.3601, lng: -71.0589 },
        'philadelphia': { lat: 39.9526, lng: -75.1652 },
        'washington': { lat: 38.9072, lng: -77.0369 },
        'pittsburgh': { lat: 40.4406, lng: -79.9959 },
        'providence': { lat: 41.8240, lng: -71.4128 },
        'roanoke': { lat: 37.2710, lng: -79.9414 },
        // Other
        'honolulu': { lat: 21.3069, lng: -157.8583 }
    };

    let closestCity = null;
    let minDistance = Infinity;

    for (const [city, coords] of Object.entries(CITY_COORDS)) {
        const distance = Math.sqrt(
            Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestCity = city;
        }
    }

    return closestCity ? REGION_SLUGS[closestCity] : null;
}

/**
 * Fetch popular routes for a region from RideWithGPS
 * GET /api/region-routes?lat=47.6&lng=-122.3
 */
app.get('/api/region-routes', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const regionSlug = findClosestRegion(lat, lng);
    if (!regionSlug) {
        return res.status(404).json({ error: 'No region found for coordinates' });
    }

    try {
        // Use JSON API endpoint instead of HTML page
        const url = `https://ridewithgps.com/regions/north_america/us/${regionSlug}.json`;
        console.log(`[Region Routes] Fetching: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'BirdRide/1.0 (Bird watching route app)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn('RideWithGPS region API error:', response.status);
            return res.status(500).json({ error: 'Failed to fetch region routes' });
        }

        const data = await response.json();

        // Extract routes from the response
        // Routes are nested inside data.extras[] with type === "route"
        const extras = data.extras || [];
        const routeEntries = extras
            .filter(item => item.type === 'route' && item.route)
            .slice(0, 10);

        const routes = routeEntries.map(item => ({
            id: String(item.route.id),
            name: item.route.name || `Route ${item.route.id}`,
            url: `https://ridewithgps.com/routes/${item.route.id}`,
            distance: item.route.distance,
            elevation: item.route.elevation_gain
        }));

        console.log(`[Region Routes] Found ${routes.length} routes for ${regionSlug}`);
        res.json({
            region: regionSlug,
            routes: routes
        });

    } catch (error) {
        console.error('Region routes error:', error.message);
        res.status(500).json({ error: 'Failed to fetch region routes' });
    }
});

/**
 * Sample coordinates evenly along a route
 */
function sampleCoordinates(coords, maxPoints) {
    if (coords.length <= maxPoints) {
        return coords;
    }

    const step = Math.floor(coords.length / maxPoints);
    const sampled = [];

    for (let i = 0; i < coords.length; i += step) {
        sampled.push(coords[i]);
        if (sampled.length >= maxPoints) break;
    }

    return sampled;
}

/**
 * SPA fallback - serve index.html for client-side routes
 * This must come after API routes but before 404
 */
app.get('/route/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all for any other routes - serve index.html
app.get('*', (req, res) => {
    // Only serve index.html for non-file requests
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).send('Not found');
    }
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('  BirdRide Server');
    console.log('  ================');
    console.log(`  Running at http://localhost:${PORT}`);
    console.log('');
    console.log('  Open this URL in your browser to use the app.');
    console.log('  Press Ctrl+C to stop the server.');
    console.log('');
});
