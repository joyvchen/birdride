/**
 * BirdRide - Filter Controls Component
 * Handles time window, distance, and rarity filtering
 */

import { getState, setState, subscribe, applyFilters } from '../utils/state.js';
import { fetchRecentBirds } from '../services/birdService.js';

// UI Elements
let timeWindowSelect;
let distanceFilterSelect;
let distanceFilterContainer;
let filterNotableBtn;
let filterAllBtn;
let rarityFilterContainer;
let mapLoadingEl;

/**
 * Initialize filter controls
 */
export function initFilterControls() {
    // Get DOM elements
    timeWindowSelect = document.getElementById('time-window');
    distanceFilterSelect = document.getElementById('distance-filter');
    distanceFilterContainer = document.getElementById('distance-filter-container');
    filterNotableBtn = document.getElementById('filter-notable');
    filterAllBtn = document.getElementById('filter-all');
    rarityFilterContainer = document.getElementById('rarity-filter-container');
    mapLoadingEl = document.getElementById('map-loading');

    // Bind select handlers
    timeWindowSelect.addEventListener('change', handleTimeWindowChange);
    distanceFilterSelect.addEventListener('change', handleDistanceFilterChange);

    // Bind rarity filter handlers
    filterNotableBtn.addEventListener('click', () => setRarityFilter('notable'));
    filterAllBtn.addEventListener('click', () => setRarityFilter('all'));

    // Subscribe to state changes to update UI
    subscribe('rarityFilter', updateFilterUI);
}

/**
 * Handle time window change
 */
async function handleTimeWindowChange(e) {
    const days = parseInt(e.target.value, 10);
    setState({ timeWindow: days });
    await loadBirdData();
}

/**
 * Handle distance filter change
 */
function handleDistanceFilterChange(e) {
    const distance = parseFloat(e.target.value);
    setState({ distanceFilter: distance });
    applyFilters();
}

/**
 * Set the rarity filter
 */
function setRarityFilter(filter) {
    setState({ rarityFilter: filter });
    applyFilters();
}

/**
 * Load bird data based on current settings
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
        const birds = await fetchRecentBirds(coordinates, state.timeWindow);

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
        timeWindow: 14,
        distanceFilter: 0.25,
        rarityFilter: 'all',
    });

    // Reset UI
    timeWindowSelect.value = '14';
    distanceFilterSelect.value = '0.25';
}
