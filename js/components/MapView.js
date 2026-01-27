/**
 * BirdRide - Map View Component
 * Handles the Leaflet map, route display, and bird markers
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { extractRouteCoordinates } from '../services/routeService.js';
import { fetchBirdPhoto } from '../services/birdService.js';

// Map instance
let map = null;
let routeLayer = null;
let birdMarkersLayer = null;
let startMarker = null;
let endMarker = null;

// Marker references for highlighting
const markersByBirdId = new Map();

// Temporary marker for alternate sighting locations
let sightingMarker = null;

// Placeholder image for bird markers (base64 encoded SVG)
const MARKER_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCBmaWxsPSIjZjNmNGY2IiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIvPjx0ZXh0IHk9Ii42NWVtIiBmb250LXNpemU9IjUwIiB4PSIyNSI+8J+QpjwvdGV4dD48L3N2Zz4=';

/**
 * Initialize the map
 */
export function initMap() {
    // Create map instance
    map = L.map('map', {
        center: [47.6062, -122.3321], // Default to Seattle
        zoom: 12,
        zoomControl: true,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    // Create marker cluster group for birds
    birdMarkersLayer = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: createClusterIcon,
    });
    map.addLayer(birdMarkersLayer);

    // Subscribe to state changes
    subscribe('filteredBirds', updateBirdMarkers);
    subscribe('selectedBird', highlightSelectedBird);
}

/**
 * Create custom cluster icon
 */
function createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    let size = 'small';
    if (count > 10) size = 'medium';
    if (count > 25) size = 'large';

    return L.divIcon({
        html: `<div>${count}</div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: L.point(40, 40),
    });
}

/**
 * Display a route on the map
 * @param {object} routeData - Route data from RideWithGPS
 */
export function displayRoute(routeData) {
    // Clear existing route
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (startMarker) {
        map.removeLayer(startMarker);
    }
    if (endMarker) {
        map.removeLayer(endMarker);
    }

    // Extract coordinates
    const coordinates = extractRouteCoordinates(routeData);
    if (coordinates.length === 0) {
        console.error('No coordinates found in route data');
        return;
    }

    // Store coordinates in state for bird queries
    setState({ routeGeoJSON: coordinates });

    // Create route polyline
    routeLayer = L.polyline(coordinates, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round',
    }).addTo(map);

    // Add start marker
    const startCoord = coordinates[0];
    startMarker = L.marker(startCoord, {
        icon: createRouteMarkerIcon('S'),
        zIndexOffset: 1000,
    }).addTo(map);
    startMarker.bindTooltip(routeData.start_location || 'Start', {
        permanent: false,
        direction: 'top',
    });

    // Add end marker (if different from start)
    const endCoord = coordinates[coordinates.length - 1];
    const isLoop = Math.abs(startCoord[0] - endCoord[0]) < 0.001 &&
                   Math.abs(startCoord[1] - endCoord[1]) < 0.001;

    if (!isLoop) {
        endMarker = L.marker(endCoord, {
            icon: createRouteMarkerIcon('E'),
            zIndexOffset: 1000,
        }).addTo(map);
        endMarker.bindTooltip('End', {
            permanent: false,
            direction: 'top',
        });
    }

    // Fit map to route bounds with asymmetric padding for sidebar
    // Use setTimeout to ensure map container has correct size after page transition
    setTimeout(() => {
        map.invalidateSize();
        const sidebarWidth = window.innerWidth > 768 ? 380 : 60;
        map.fitBounds(routeLayer.getBounds(), {
            paddingTopLeft: [60, 60],
            paddingBottomRight: [sidebarWidth, 60],
            animate: false,
        });
    }, 150);
}

/**
 * Create a route start/end marker icon
 */
function createRouteMarkerIcon(label) {
    return L.divIcon({
        html: label,
        className: 'route-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

/**
 * Update bird markers on the map
 * @param {array} birds - Filtered bird data
 */
function updateBirdMarkers(birds) {
    // Clear existing markers
    birdMarkersLayer.clearLayers();
    markersByBirdId.clear();

    if (!birds || birds.length === 0) {
        return;
    }

    // Add markers for each bird
    birds.forEach((bird, index) => {
        const marker = createBirdMarker(bird, index);
        birdMarkersLayer.addLayer(marker);
        markersByBirdId.set(index, marker);
    });

    // Load photos asynchronously to update marker icons
    loadMarkerPhotos(birds);
}

// Cache of loaded photo URLs by species code
const photoUrlCache = new Map();

/**
 * Load photos asynchronously for marker icons
 */
async function loadMarkerPhotos(birds) {
    for (let i = 0; i < birds.length; i++) {
        const bird = birds[i];
        try {
            const photoData = await fetchBirdPhoto(bird.speciesCode, bird.comName);
            if (photoData && photoData.thumbnail) {
                // Cache the photo URL for this species
                photoUrlCache.set(bird.speciesCode, photoData.thumbnail);

                // Update the marker's icon with the real photo
                const marker = markersByBirdId.get(i);
                if (marker) {
                    const newIcon = createBirdIconWithPhoto(bird, i, photoData.thumbnail);
                    marker.setIcon(newIcon);
                }
            }
        } catch (error) {
            // Silently fail for individual photos
        }
    }
}

/**
 * Create a bird marker
 */
function createBirdMarker(bird, index) {
    const icon = createBirdIcon(bird, index);

    const marker = L.marker([bird.lat, bird.lng], {
        icon: icon,
        riseOnHover: true,
    });

    // Store bird data on marker for photo loading
    marker.birdData = { ...bird, index };

    // Add tooltip
    marker.bindTooltip(bird.comName, {
        permanent: false,
        direction: 'top',
        className: 'bird-tooltip',
    });

    // Handle click - stop propagation to prevent map click handler from closing detail
    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setState({ selectedBird: { ...bird, index } });
    });

    return marker;
}

/**
 * Create custom bird marker icon
 */
function createBirdIcon(bird, index) {
    // Check if we have a cached photo for this species
    const photoUrl = photoUrlCache.get(bird.speciesCode) || MARKER_PLACEHOLDER;
    return createBirdIconWithPhoto(bird, index, photoUrl);
}

/**
 * Create custom bird marker icon with a specific photo URL
 */
function createBirdIconWithPhoto(bird, index, photoUrl) {
    const rarityClass = bird.rarity || 'common';

    return L.divIcon({
        html: `
            <div class="bird-marker ${rarityClass}" data-marker-index="${index}">
                <img src="${photoUrl}" alt="" class="bird-marker-img">
            </div>
        `,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
}

/**
 * Create a temporary sighting marker at an alternate location
 */
function createSightingMarker(lat, lng, bird) {
    // Remove existing sighting marker if any
    if (sightingMarker) {
        map.removeLayer(sightingMarker);
        sightingMarker = null;
    }

    // Get photo URL from cache or use placeholder
    const photoUrl = photoUrlCache.get(bird.speciesCode) || MARKER_PLACEHOLDER;
    const rarityClass = bird.rarity || 'common';

    const icon = L.divIcon({
        html: `
            <div class="bird-marker sighting-highlight ${rarityClass}">
                <img src="${photoUrl}" alt="" class="bird-marker-img">
            </div>
        `,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });

    sightingMarker = L.marker([lat, lng], {
        icon: icon,
        zIndexOffset: 2000,  // Above other markers
    }).addTo(map);

    sightingMarker.bindTooltip(bird.comName, {
        permanent: false,
        direction: 'top',
        className: 'bird-tooltip',
    });

    return sightingMarker;
}

/**
 * Highlight the selected bird marker
 */
function highlightSelectedBird(bird) {
    // Remove highlight from all markers
    document.querySelectorAll('.bird-marker.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Remove any existing sighting marker
    if (sightingMarker) {
        map.removeLayer(sightingMarker);
        sightingMarker = null;
    }

    if (!bird) return;

    const marker = markersByBirdId.get(bird.index);
    if (!marker) return;

    // Check if the selected coordinates differ from the primary marker location
    const markerLatLng = marker.getLatLng();
    const isAlternateLocation =
        Math.abs(markerLatLng.lat - bird.lat) > 0.0001 ||
        Math.abs(markerLatLng.lng - bird.lng) > 0.0001;

    if (isAlternateLocation) {
        // Create a temporary marker at the alternate sighting location
        const tempMarker = createSightingMarker(bird.lat, bird.lng, bird);
        map.panTo([bird.lat, bird.lng], { animate: true, duration: 0.5 });
        tempMarker.openTooltip();
    } else {
        // Primary location - use existing marker highlighting logic
        const highlightMarker = () => {
            const markerEl = document.querySelector(`[data-marker-index="${bird.index}"]`);
            if (markerEl) {
                markerEl.classList.add('selected');
            }
            marker.openTooltip();
        };

        const visibleParent = birdMarkersLayer.getVisibleParent(marker);
        if (visibleParent === marker) {
            map.panTo([bird.lat, bird.lng], { animate: true, duration: 0.5 });
            highlightMarker();
        } else {
            birdMarkersLayer.zoomToShowLayer(marker, highlightMarker);
        }
    }
}

/**
 * Pan to a specific bird
 */
export function panToBird(bird) {
    if (map && bird) {
        map.panTo([bird.lat, bird.lng], {
            animate: true,
            duration: 0.5,
        });
    }
}

/**
 * Resize the map (call when container size changes)
 */
export function invalidateMapSize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

/**
 * Get the map instance
 */
export function getMap() {
    return map;
}

/**
 * Clean up map resources
 */
export function destroyMap() {
    if (map) {
        // Clean up sighting marker
        if (sightingMarker) {
            map.removeLayer(sightingMarker);
            sightingMarker = null;
        }
        map.remove();
        map = null;
        routeLayer = null;
        birdMarkersLayer = null;
        startMarker = null;
        endMarker = null;
        markersByBirdId.clear();
    }
}
