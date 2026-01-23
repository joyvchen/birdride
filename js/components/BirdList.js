/**
 * BirdRide - Bird List Component
 * Sidebar/bottom sheet displaying birds along the route
 */

import { getState, setState, subscribe } from '../utils/state.js';
import { getBirdPhotoUrl, formatObservationDate } from '../services/birdService.js';

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

    // Subscribe to state changes
    subscribe('filteredBirds', renderBirdList);
    subscribe('selectedBird', highlightSelectedCard);
    subscribe('mode', updateEmptyStateMessage);
    subscribe('rarityFilter', updateEmptyStateMessage);
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
        card.addEventListener('click', () => handleCardClick(birds[index], index));
    });
}

/**
 * Create a bird card HTML
 */
function createBirdCard(bird, index) {
    const state = getState();
    const isRecent = state.mode === 'recent';

    const photoUrl = getBirdPhotoUrl(bird.comName);
    const rarityClass = bird.rarity || 'common';
    const rarityLabel = capitalizeFirst(bird.rarity || 'common');

    let metaInfo;
    if (isRecent && bird.obsDt) {
        metaInfo = formatObservationDate(bird.obsDt);
    } else if (bird.frequency) {
        metaInfo = bird.frequency;
    } else if (bird.expectedIn) {
        metaInfo = bird.expectedIn;
    } else {
        metaInfo = '';
    }

    return `
        <div class="bird-card" data-index="${index}">
            <img
                class="bird-card-photo"
                src="${photoUrl}"
                alt="${bird.comName}"
                onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>🐦</text></svg>'"
            >
            <div class="bird-card-info">
                <div class="bird-card-name">${bird.comName}</div>
                <div class="bird-card-meta">
                    <span class="bird-card-rarity">
                        <span class="rarity-dot ${rarityClass}"></span>
                        <span class="rarity-text ${rarityClass}">${rarityLabel}</span>
                    </span>
                    ${metaInfo ? `<span class="bird-card-date">${metaInfo}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Handle card click
 */
function handleCardClick(bird, index) {
    setState({ selectedBird: { ...bird, index } });
}

/**
 * Highlight the selected card
 */
function highlightSelectedCard(bird) {
    // Remove previous highlight
    if (activeCardIndex !== null) {
        const prevCard = listEl.querySelector(`[data-index="${activeCardIndex}"]`);
        if (prevCard) {
            prevCard.classList.remove('active');
        }
    }

    if (!bird) {
        activeCardIndex = null;
        return;
    }

    // Add highlight to current card
    activeCardIndex = bird.index;
    const card = listEl.querySelector(`[data-index="${bird.index}"]`);
    if (card) {
        card.classList.add('active');
        // Scroll card into view
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Update empty state message based on current filters
 */
function updateEmptyStateMessage() {
    const state = getState();

    if (state.mode === 'recent') {
        if (state.rarityFilter === 'notable') {
            emptyMessageEl.textContent = 'No rare birds reported recently';
            emptySuggestionEl.textContent = 'Toggle to "All Birds" to see common species.';
        } else {
            emptyMessageEl.textContent = 'No recent bird sightings';
            emptySuggestionEl.textContent = 'Try a different route or check back later.';
        }
    } else {
        if (state.rarityFilter === 'notable') {
            emptyMessageEl.textContent = 'No rare birds expected';
            emptySuggestionEl.textContent = 'Toggle to "All Birds" to see common species.';
        } else {
            emptyMessageEl.textContent = 'No bird data available';
            emptySuggestionEl.textContent = 'Bird data is limited in this area.';
        }
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
