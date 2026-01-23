/**
 * BirdRide - Bird Detail Component
 * Shows detailed information about a selected bird
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { getBirdPhotoUrl, getEBirdSpeciesUrl, formatObservationDate, getLocationDescription } from '../services/birdService.js';

// UI Elements
let detailEl;
let closeBtn;
let photoEl;
let nameEl;
let scientificEl;
let rarityEl;
let dateEl;
let locationEl;
let observersEl;
let linkEl;

/**
 * Initialize the bird detail component
 */
export function initBirdDetail() {
    // Get DOM elements
    detailEl = document.getElementById('bird-detail');
    closeBtn = document.getElementById('close-detail');
    photoEl = document.getElementById('detail-photo');
    nameEl = document.getElementById('detail-name');
    scientificEl = document.getElementById('detail-scientific');
    rarityEl = document.getElementById('detail-rarity');
    dateEl = document.getElementById('detail-date');
    locationEl = document.getElementById('detail-location');
    observersEl = document.getElementById('detail-observers');
    linkEl = document.getElementById('detail-link');

    // Bind close button
    closeBtn.addEventListener('click', closeDetail);

    // Close on click outside (on map)
    document.getElementById('map').addEventListener('click', (e) => {
        // Only close if clicking directly on map, not on a marker
        if (e.target.classList.contains('leaflet-container') ||
            e.target.classList.contains('leaflet-tile')) {
            closeDetail();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !detailEl.classList.contains('hidden')) {
            closeDetail();
        }
    });

    // Subscribe to selected bird changes
    subscribe('selectedBird', showBirdDetail);
}

/**
 * Show bird detail panel
 * @param {object} bird - Selected bird data
 */
function showBirdDetail(bird) {
    if (!bird) {
        return;
    }

    const state = getState();
    const isRecent = state.mode === 'recent';

    // Set photo
    const photoUrl = getBirdPhotoUrl(bird.comName);
    photoEl.src = photoUrl;
    photoEl.alt = bird.comName;

    // Set names
    nameEl.textContent = bird.comName;
    scientificEl.textContent = bird.sciName;

    // Set rarity
    const rarityClass = bird.rarity || 'common';
    const rarityLabel = getRarityLabel(bird.rarity);
    rarityEl.className = `detail-rarity ${rarityClass}`;
    rarityEl.innerHTML = `
        <span class="rarity-dot ${rarityClass}"></span>
        ${rarityLabel}
    `;

    // Set date/frequency info (different for recent vs expected modes)
    if (isRecent) {
        // Recent sightings mode - show date
        if (bird.obsDt) {
            dateEl.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Seen: ${formatObservationDate(bird.obsDt)}
            `;
            dateEl.classList.remove('hidden');
        } else {
            dateEl.classList.add('hidden');
        }

        // Show observers
        if (bird.numObservers) {
            observersEl.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                Reported by ${bird.numObservers} observer${bird.numObservers > 1 ? 's' : ''}
            `;
            observersEl.classList.remove('hidden');
        } else {
            observersEl.classList.add('hidden');
        }
    } else {
        // Expected birds mode - show frequency
        if (bird.frequency) {
            dateEl.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 3v18h18"></path>
                    <path d="M18 9l-5 5-4-4-3 3"></path>
                </svg>
                ${bird.frequency} in ${bird.expectedIn || 'this month'}
            `;
            dateEl.classList.remove('hidden');
        } else {
            dateEl.classList.add('hidden');
        }

        // Show habitat instead of observers
        if (bird.habitat) {
            observersEl.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22c-4-4-8-7-8-12a8 8 0 1116 0c0 5-4 8-8 12z"></path>
                </svg>
                Look near: ${bird.habitat}
            `;
            observersEl.classList.remove('hidden');
        } else {
            observersEl.classList.add('hidden');
        }
    }

    // Set location along route
    const route = state.route;
    const coordinates = state.routeGeoJSON;
    if (coordinates && route) {
        const locDesc = getLocationDescription(bird, coordinates, route.distance);
        locationEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${locDesc}
        `;
        locationEl.classList.remove('hidden');
    } else {
        locationEl.classList.add('hidden');
    }

    // Set eBird link
    linkEl.href = getEBirdSpeciesUrl(bird.speciesCode);

    // Show panel with animation
    detailEl.classList.remove('hidden');
}

/**
 * Get human-readable rarity label
 */
function getRarityLabel(rarity) {
    switch (rarity) {
        case 'rare':
            return 'Rare in this area';
        case 'uncommon':
            return 'Uncommon in this area';
        case 'common':
        default:
            return 'Common in this area';
    }
}

/**
 * Close the detail panel
 */
export function closeDetail() {
    detailEl.classList.add('hidden');
    setState({ selectedBird: null });
}

/**
 * Check if detail panel is open
 */
export function isDetailOpen() {
    return !detailEl.classList.contains('hidden');
}
