/**
 * BirdRide - Map View Component
 * Handles the Leaflet map, route display, and bird markers
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { extractRouteCoordinates, calculateRouteBounds } from '../services/routeService.js';
import { getBirdPhotoUrl } from '../services/birdService.js';

// Map instance
let map = null;
let routeLayer = null;
let birdMarkersLayer = null;
let startMarker = null;
let endMarker = null;

// Marker references for highlighting
const markersByBirdId = new Map();

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

    // Fit map to route bounds
    const bounds = calculateRouteBounds(coordinates);
    if (bounds) {
        map.fitBounds([
            [bounds.south, bounds.west],
            [bounds.north, bounds.east],
        ], {
            padding: [50, 50],
        });
    }
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
}

/**
 * Create a bird marker
 */
function createBirdMarker(bird, index) {
    const icon = createBirdIcon(bird);

    const marker = L.marker([bird.lat, bird.lng], {
        icon: icon,
        riseOnHover: true,
    });

    // Add tooltip
    marker.bindTooltip(bird.comName, {
        permanent: false,
        direction: 'top',
        className: 'bird-tooltip',
    });

    // Handle click
    marker.on('click', () => {
        setState({ selectedBird: { ...bird, index } });
    });

    return marker;
}

/**
 * Create custom bird marker icon
 */
function createBirdIcon(bird) {
    const photoUrl = getBirdPhotoUrl(bird.comName);
    const rarityClass = bird.rarity || 'common';

    return L.divIcon({
        html: `
            <div class="bird-marker ${rarityClass}">
                <img src="${photoUrl}" alt="${bird.comName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <span class="bird-marker-icon" style="display:none;">🐦</span>
            </div>
        `,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
    });
}

/**
 * Highlight the selected bird marker
 */
function highlightSelectedBird(bird) {
    if (!bird) return;

    const marker = markersByBirdId.get(bird.index);
    if (marker) {
        // Pan to marker
        map.panTo([bird.lat, bird.lng], {
            animate: true,
            duration: 0.5,
        });

        // Open tooltip briefly
        marker.openTooltip();
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
        map.remove();
        map = null;
        routeLayer = null;
        birdMarkersLayer = null;
        startMarker = null;
        endMarker = null;
        markersByBirdId.clear();
    }
}
