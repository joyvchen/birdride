/**
 * BirdRide - Bird List Component
 * Sidebar/bottom sheet displaying birds along the route
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { getBirdPhotoUrl, fetchBirdPhoto, getEBirdSpeciesUrl, formatObservationDate, getLocationDescription } from '../services/birdService.js';

// UI Elements
let sidebarEl;
let listEl;
let countEl;
let emptyStateEl;
let emptyMessageEl;
let emptySuggestionEl;

// Currently active card
let activeCardIndex = null;

/**
 * Initialize the bird list component
 */
export function initBirdList() {
    // Get DOM elements
    sidebarEl = document.getElementById('bird-sidebar');
    listEl = document.getElementById('bird-list');
    countEl = document.getElementById('bird-count');
    emptyStateEl = document.getElementById('empty-state');
    emptyMessageEl = document.getElementById('empty-message');
    emptySuggestionEl = document.getElementById('empty-suggestion');

    // Set up mobile bottom sheet behavior
    setupBottomSheet();

    // Set up keyboard handlers
    setupKeyboardHandlers();

    // Subscribe to state changes
    subscribe('filteredBirds', renderBirdList);
    subscribe('selectedBird', highlightSelectedCard);
    subscribe('rarityFilter', updateEmptyStateMessage);
}

/**
 * Set up keyboard handlers for card expansion
 */
function setupKeyboardHandlers() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const expandedCard = listEl.querySelector('.bird-card.expanded');
            if (expandedCard) {
                expandedCard.classList.remove('expanded');
                setState({ selectedBird: null });
            }
        }
    });
}

/**
 * Set up mobile bottom sheet behavior
 */
function setupBottomSheet() {
    const header = sidebarEl.querySelector('.sidebar-header');

    // Toggle expanded state on header click (mobile)
    header.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            sidebarEl.classList.toggle('expanded');
            setState({ sidebarExpanded: sidebarEl.classList.contains('expanded') });
        }
    });

    // Handle touch gestures for swipe
    let startY = 0;
    let currentY = 0;

    header.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    }, { passive: true });

    header.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
    }, { passive: true });

    header.addEventListener('touchend', () => {
        const deltaY = currentY - startY;
        if (Math.abs(deltaY) > 50) {
            if (deltaY < 0) {
                // Swipe up - expand
                sidebarEl.classList.add('expanded');
            } else {
                // Swipe down - collapse
                sidebarEl.classList.remove('expanded');
            }
            setState({ sidebarExpanded: sidebarEl.classList.contains('expanded') });
        }
    });
}

/**
 * Render the bird list
 * @param {array} birds - Filtered birds to display
 */
function renderBirdList(birds) {
    const state = getState();

    // Update count
    const filterLabel = state.rarityFilter === 'notable' ? 'Notable Birds' : 'Species';
    countEl.textContent = `${birds.length} ${filterLabel}`;

    // Handle empty state
    if (birds.length === 0) {
        listEl.classList.add('hidden');
        emptyStateEl.classList.remove('hidden');
        updateEmptyStateMessage();
        return;
    }

    // Show list
    listEl.classList.remove('hidden');
    emptyStateEl.classList.add('hidden');

    // Render bird cards
    listEl.innerHTML = birds.map((bird, index) => createBirdCard(bird, index)).join('');

    // Bind click handlers
    listEl.querySelectorAll('.bird-card').forEach((card, index) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;  // Don't toggle on link clicks
            if (e.target.closest('.sighting-row')) return;  // Don't toggle on sighting row clicks
            handleCardClick(birds[index], index);
        });
    });

    // Bind sighting row click handlers
    listEl.querySelectorAll('.sighting-row').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;  // Don't trigger on link clicks
            const lat = parseFloat(row.dataset.lat);
            const lng = parseFloat(row.dataset.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                // Update selected bird to pan map to this sighting
                const state = getState();
                const selectedBird = state.selectedBird;
                if (selectedBird) {
                    setState({ selectedBird: { ...selectedBird, lat, lng } });
                }
            }
        });
    });

    // Load bird photos asynchronously
    loadBirdPhotos(birds);
}

/**
 * Load bird photos asynchronously for all birds in the list
 */
async function loadBirdPhotos(birds) {
    for (const bird of birds) {
        try {
            const photoData = await fetchBirdPhoto(bird.speciesCode, bird.comName);
            if (photoData && photoData.thumbnail) {
                // Update the photo in the list
                const img = listEl.querySelector(`[data-species="${bird.speciesCode}"]`);
                if (img) {
                    img.src = photoData.thumbnail;
                }
            }
        } catch (error) {
            // Silently fail for individual photos
        }
    }
}

// Placeholder image for failed photo loads
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCBmaWxsPSIjZjNmNGY2IiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIvPjx0ZXh0IHk9Ii42NWVtIiBmb250LXNpemU9IjUwIiB4PSIyNSI+8J+QpjwvdGV4dD48L3N2Zz4=';

/**
 * Render sightings list for expanded card
 * @param {array} sightings - Array of sighting objects
 * @param {string} currentSubId - The subId of the current observation to highlight
 * @returns {string} HTML string for sightings section
 */
function renderSightingsList(sightings, currentSubId) {
    if (!sightings || sightings.length === 0) return '';

    const sightingRows = sightings.map(sighting => {
        const isCurrentSighting = sighting.subId === currentSubId;
        return `
            <div class="sighting-row ${isCurrentSighting ? 'current' : ''}"
                 data-lat="${sighting.lat}"
                 data-lng="${sighting.lng}"
                 data-sighting-subid="${sighting.subId}">
                <div class="sighting-info">
                    ${isCurrentSighting ? '<span class="sighting-current-label">This observation</span>' : ''}
                    <span class="sighting-date">${formatObservationDate(sighting.obsDt)}</span>
                    ${sighting.locName ? `<span class="sighting-location">${escapeHtml(sighting.locName)}</span>` : ''}
                </div>
                ${sighting.howMany > 1 ? `<span class="sighting-count">×${sighting.howMany}</span>` : ''}
                ${sighting.subId ? `
                    <a class="sighting-link" href="https://ebird.org/checklist/${sighting.subId}"
                       target="_blank" rel="noopener" title="View checklist on eBird">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path>
                        </svg>
                    </a>
                ` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="sightings-section">
            <div class="sightings-header">All observations along route</div>
            <div class="sightings-list">${sightingRows}</div>
        </div>
    `;
}

/**
 * Create a bird card HTML
 */
function createBirdCard(bird, index) {
    const rarityClass = bird.rarity || 'common';
    const rarityLabel = bird.rarity === 'rare' ? 'Notable' : capitalizeFirst(bird.rarity || 'common');

    // Show observation date if available
    const metaInfo = bird.obsDt ? formatObservationDate(bird.obsDt) : '';

    // Escape bird name for safe HTML attribute use
    const safeName = escapeHtml(bird.comName);
    const safeScientificName = bird.sciName ? escapeHtml(bird.sciName) : '';

    // Get eBird link
    const ebirdUrl = getEBirdSpeciesUrl(bird.speciesCode);

    return `
        <div class="bird-card" data-index="${index}" data-species-code="${bird.speciesCode}">
            <div class="bird-card-header">
                <img
                    class="bird-card-photo"
                    data-species="${bird.speciesCode}"
                    src="${PLACEHOLDER_IMAGE}"
                    alt="${safeName}"
                >
                <div class="bird-card-info">
                    <div class="bird-card-name">${safeName}</div>
                    <div class="bird-card-meta">
                        <span class="bird-card-rarity">
                            <span class="rarity-dot ${rarityClass}"></span>
                            <span class="rarity-text ${rarityClass}">${rarityLabel}</span>
                        </span>
                        ${metaInfo ? `<span class="bird-card-date">${metaInfo}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="bird-card-detail">
                <img
                    class="bird-card-detail-photo"
                    data-detail-species="${bird.speciesCode}"
                    src="${PLACEHOLDER_IMAGE}"
                    alt="${safeName}"
                >
                ${safeScientificName ? `<div class="bird-card-scientific">${safeScientificName}</div>` : ''}
                <div class="bird-card-detail-meta">
                    ${bird.locName ? `<span class="bird-card-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${escapeHtml(bird.locName)}
                    </span>` : ''}
                    ${bird.obsDt ? `<span class="bird-card-detail-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formatObservationDate(bird.obsDt)}
                    </span>` : ''}
                </div>
                <a class="bird-card-detail-link" href="${ebirdUrl}" target="_blank" rel="noopener">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path>
                    </svg>
                    View species on eBird
                </a>
                ${bird.sightings && bird.sightings.length > 0 ? renderSightingsList(bird.sightings, bird.subId) : ''}
            </div>
        </div>
    `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle card click
 */
function handleCardClick(bird, index) {
    const card = listEl.querySelector(`[data-index="${index}"]`);
    const wasExpanded = card.classList.contains('expanded');

    // Collapse any previously expanded card
    const prevExpanded = listEl.querySelector('.bird-card.expanded');
    if (prevExpanded && prevExpanded !== card) {
        prevExpanded.classList.remove('expanded');
    }

    // Toggle this card
    if (wasExpanded) {
        card.classList.remove('expanded');
        setState({ selectedBird: null });
    } else {
        card.classList.add('expanded');
        setState({ selectedBird: { ...bird, index } });
        loadExpandedPhoto(card, bird);
    }
}

/**
 * Load high-res photo when card expands
 */
async function loadExpandedPhoto(card, bird) {
    const detailPhoto = card.querySelector('.bird-card-detail-photo');
    if (!detailPhoto) return;

    try {
        const photoData = await fetchBirdPhoto(bird.speciesCode, bird.comName);
        if (photoData && photoData.large) {
            detailPhoto.src = photoData.large;
        } else if (photoData && photoData.thumbnail) {
            detailPhoto.src = photoData.thumbnail;
        }
    } catch (error) {
        console.warn('Failed to load expanded photo:', error);
    }
}

/**
 * Highlight the selected card and handle expansion
 */
function highlightSelectedCard(bird) {
    // Collapse any previously expanded card
    if (activeCardIndex !== null) {
        const prevCard = listEl.querySelector(`[data-index="${activeCardIndex}"]`);
        if (prevCard) {
            prevCard.classList.remove('active');
            prevCard.classList.remove('expanded');
        }
    }

    if (!bird) {
        activeCardIndex = null;
        return;
    }

    // Add highlight and expand current card
    activeCardIndex = bird.index;
    const card = listEl.querySelector(`[data-index="${bird.index}"]`);
    if (card) {
        card.classList.add('active');
        card.classList.add('expanded');
        // Load expanded photo
        loadExpandedPhoto(card, bird);
        // Scroll card into view
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Update empty state message based on current filters
 */
function updateEmptyStateMessage() {
    const state = getState();

    if (state.rarityFilter === 'notable') {
        emptyMessageEl.textContent = 'No notable birds reported recently';
        emptySuggestionEl.textContent = 'Toggle to "All Birds" to see common species.';
    } else {
        emptyMessageEl.textContent = 'No recent bird sightings';
        emptySuggestionEl.textContent = 'Try a different route or check back later.';
    }
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Show/expand the sidebar (for mobile)
 */
export function expandSidebar() {
    sidebarEl.classList.add('expanded');
    setState({ sidebarExpanded: true });
}

/**
 * Hide/collapse the sidebar (for mobile)
 */
export function collapseSidebar() {
    sidebarEl.classList.remove('expanded');
    setState({ sidebarExpanded: false });
}

/**
 * Toggle sidebar expanded state
 */
export function toggleSidebar() {
    sidebarEl.classList.toggle('expanded');
    setState({ sidebarExpanded: sidebarEl.classList.contains('expanded') });
}
