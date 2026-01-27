/**
 * BirdRide - Backend Server
 * Simple Express server to proxy API requests and serve static files
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// eBird API key (set via environment variable)
const EBIRD_API_KEY = process.env.EBIRD_API_KEY;
if (!EBIRD_API_KEY) {
    console.error('ERROR: EBIRD_API_KEY environment variable is required');
    console.error('Get your free key at: https://ebird.org/api/keygen');
    process.exit(1);
}

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
            thumbnail: `${photo.previewUrl}320`,
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
            thumbnail: `${photo.previewUrl}320`,
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
                    imageUrl: `https://macaulaylibrary.org/asset/${assetId}`
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
                return res.json({
                    speciesCode: speciesCode,
                    assetId: parseInt(assetMatch[1]),
                    imageUrl: `https://macaulaylibrary.org/asset/${assetMatch[1]}`
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
