/**
 * BirdRide - Filter Controls Component
 * Handles mode selection (Recent/Expected) and rarity filtering (Notable/All)
 */

import { getState, setState, subscribe, applyFilters } from '../utils/state.js';
import { fetchRecentBirds, fetchExpectedBirds } from '../services/birdService.js';

// UI Elements
let modeRecentBtn;
let modeExpectedBtn;
let timeWindowSelect;
let monthSelect;
let filterNotableBtn;
let filterAllBtn;
let mapLoadingEl;

/**
 * Initialize filter controls
 */
export function initFilterControls() {
    // Get DOM elements
    modeRecentBtn = document.getElementById('mode-recent');
    modeExpectedBtn = document.getElementById('mode-expected');
    timeWindowSelect = document.getElementById('time-window');
    monthSelect = document.getElementById('month-select');
    filterNotableBtn = document.getElementById('filter-notable');
    filterAllBtn = document.getElementById('filter-all');
    mapLoadingEl = document.getElementById('map-loading');

    // Set current month as default for month selector
    const currentMonth = new Date().getMonth() + 1;
    monthSelect.value = currentMonth.toString();
    setState({ selectedMonth: currentMonth });

    // Bind mode button handlers
    modeRecentBtn.addEventListener('click', () => setMode('recent'));
    modeExpectedBtn.addEventListener('click', () => setMode('expected'));

    // Bind select handlers (these change params within a mode)
    timeWindowSelect.addEventListener('change', handleTimeWindowChange);
    monthSelect.addEventListener('change', handleMonthChange);

    // Prevent clicks on selects from triggering mode button
    timeWindowSelect.addEventListener('click', (e) => e.stopPropagation());
    monthSelect.addEventListener('click', (e) => e.stopPropagation());

    // Bind rarity filter handlers
    filterNotableBtn.addEventListener('click', () => setRarityFilter('notable'));
    filterAllBtn.addEventListener('click', () => setRarityFilter('all'));

    // Subscribe to state changes to update UI
    subscribe('mode', updateModeUI);
    subscribe('rarityFilter', updateFilterUI);
}

/**
 * Set the viewing mode (recent sightings or expected birds)
 */
async function setMode(mode) {
    const state = getState();

    // Don't reload if already in this mode
    if (state.mode === mode) {
        return;
    }

    setState({ mode });
    await loadBirdData();
}

/**
 * Handle time window change (for recent mode)
 */
async function handleTimeWindowChange(e) {
    const days = parseInt(e.target.value, 10);
    setState({ timeWindow: days });

    // Only reload if we're in recent mode
    if (getState().mode === 'recent') {
        await loadBirdData();
    }
}

/**
 * Handle month change (for expected mode)
 */
async function handleMonthChange(e) {
    const month = parseInt(e.target.value, 10);
    setState({ selectedMonth: month });

    // Only reload if we're in expected mode
    if (getState().mode === 'expected') {
        await loadBirdData();
    }
}

/**
 * Set the rarity filter
 */
function setRarityFilter(filter) {
    setState({ rarityFilter: filter });
    applyFilters();
}

/**
 * Load bird data based on current mode and settings
 */
export async function loadBirdData() {
    const state = getState();
    const coordinates = state.routeGeoJSON;

    if (!coordinates || coordinates.length === 0) {
        console.warn('No route coordinates available');
        return;
    }

    // Show loading indicator
    showLoading();

    try {
        let birds;

        if (state.mode === 'recent') {
            // Fetch recent sightings
            birds = await fetchRecentBirds(coordinates, state.timeWindow);
        } else {
            // Fetch expected birds for the selected month
            birds = await fetchExpectedBirds(coordinates, state.selectedMonth);
        }

        // Update state with bird data
        setState({ birds });

        // Apply current filters
        applyFilters();

    } catch (error) {
        console.error('Error loading bird data:', error);
        setState({ birds: [], filteredBirds: [] });
    } finally {
        hideLoading();
    }
}

/**
 * Update mode button UI
 */
function updateModeUI(mode) {
    if (mode === 'recent') {
        modeRecentBtn.classList.add('active');
        modeExpectedBtn.classList.remove('active');
    } else {
        modeRecentBtn.classList.remove('active');
        modeExpectedBtn.classList.add('active');
    }
}

/**
 * Update rarity filter button UI
 */
function updateFilterUI(filter) {
    if (filter === 'notable') {
        filterNotableBtn.classList.add('active');
        filterAllBtn.classList.remove('active');
    } else {
        filterNotableBtn.classList.remove('active');
        filterAllBtn.classList.add('active');
    }
}

/**
 * Show loading indicator on map
 */
function showLoading() {
    mapLoadingEl.classList.remove('hidden');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    mapLoadingEl.classList.add('hidden');
}

/**
 * Reset filters to defaults
 */
export function resetFilters() {
    setState({
        mode: 'recent',
        timeWindow: 14,
        selectedMonth: new Date().getMonth() + 1,
        rarityFilter: 'notable',
    });

    // Reset UI
    timeWindowSelect.value = '14';
    monthSelect.value = (new Date().getMonth() + 1).toString();
}
