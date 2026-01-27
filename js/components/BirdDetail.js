/**
 * BirdRide - Bird Detail Component
 * Shows detailed information about a selected bird
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { getBirdPhotoUrl, fetchBirdPhoto, getEBirdSpeciesUrl, formatObservationDate, getLocationDescription } from '../services/birdService.js';

// UI Elements
let detailEl;
let closeBtn;
let photoEl;
let photoCreditEl;
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
    photoCreditEl = document.getElementById('detail-photo-credit');
    nameEl = document.getElementById('detail-name');
    scientificEl = document.getElementById('detail-scientific');
    rarityEl = document.getElementById('detail-rarity');
    dateEl = document.getElementById('detail-date');
    locationEl = document.getElementById('detail-location');
    observersEl = document.getElementById('detail-observers');
    linkEl = document.getElementById('detail-link');

    // Bind close button
    closeBtn.addEventListener('click', closeDetail);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && detailEl.classList.contains('visible')) {
            closeDetail();
        }
    });

    // Subscribe to selected bird changes
    subscribe('selectedBird', showBirdDetail);
}

/**
 * Show bird detail panel
 * NOTE: Bird details are now shown inline in expandable cards in BirdList.js
 * This function is kept as a no-op for compatibility.
 * @param {object} bird - Selected bird data
 */
async function showBirdDetail(bird) {
    // Bird details are now displayed inline in expandable cards
    // This panel is no longer used - see BirdList.js for the new implementation
    return;
}

/**
 * Render the list of sightings for a bird
 * @param {array} sightings - Array of sighting objects
 */
function renderSightingsList(sightings) {
    // Remove existing sightings section if present
    const existingSection = detailEl.querySelector('.sightings-section');
    if (existingSection) {
        existingSection.remove();
    }

    // Don't render if no sightings or only one sighting
    if (!sightings || sightings.length <= 1) {
        return;
    }

    // Create sightings section
    const section = document.createElement('div');
    section.className = 'sightings-section';

    const header = document.createElement('div');
    header.className = 'sightings-header';
    header.textContent = `${sightings.length} Sightings`;
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'sightings-list';

    for (const sighting of sightings) {
        const row = document.createElement('div');
        row.className = 'sighting-row';

        const info = document.createElement('div');
        info.className = 'sighting-info';

        const date = document.createElement('span');
        date.className = 'sighting-date';
        date.textContent = formatObservationDate(sighting.obsDt);
        info.appendChild(date);

        if (sighting.locName) {
            const location = document.createElement('span');
            location.className = 'sighting-location';
            location.textContent = sighting.locName;
            info.appendChild(location);
        }

        row.appendChild(info);

        if (sighting.howMany && sighting.howMany > 1) {
            const count = document.createElement('span');
            count.className = 'sighting-count';
            count.textContent = `×${sighting.howMany}`;
            row.appendChild(count);
        }

        if (sighting.subId) {
            const link = document.createElement('a');
            link.className = 'sighting-link';
            link.href = `https://ebird.org/checklist/${sighting.subId}`;
            link.target = '_blank';
            link.rel = 'noopener';
            link.title = 'View checklist on eBird';
            link.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path>
                </svg>
            `;
            row.appendChild(link);
        }

        list.appendChild(row);
    }

    section.appendChild(list);

    // Insert after detail-meta
    const detailInfo = detailEl.querySelector('.detail-info');
    const detailLink = detailInfo.querySelector('.detail-link');
    detailInfo.insertBefore(section, detailLink);
}

/**
 * Get human-readable rarity label
 */
function getRarityLabel(rarity) {
    switch (rarity) {
        case 'rare':
            return 'Notable in this area';
        case 'uncommon':
            return 'Uncommon in this area';
        case 'common':
        default:
            return 'Common in this area';
    }
}

/**
 * Load bird photo from Macaulay Library
 * @param {string} speciesCode - eBird species code
 * @param {string} comName - Common name for fallback search
 */
async function loadBirdPhoto(speciesCode, comName = null) {
    try {
        const photoData = await fetchBirdPhoto(speciesCode, comName);

        if (photoData && photoData.large) {
            photoEl.src = photoData.large;

            // Show photo credit if available
            if (photoCreditEl && photoData.credit) {
                photoCreditEl.textContent = `Photo: ${photoData.credit}`;
                photoCreditEl.classList.remove('hidden');
            } else if (photoCreditEl) {
                photoCreditEl.classList.add('hidden');
            }
        }
    } catch (error) {
        console.warn('Failed to load bird photo:', error);
    }
}

/**
 * Close the detail panel
 */
export function closeDetail() {
    detailEl.classList.remove('visible');
    detailEl.classList.add('hidden');
    setState({ selectedBird: null });
}

/**
 * Check if detail panel is open
 */
export function isDetailOpen() {
    return detailEl.classList.contains('visible');
}
