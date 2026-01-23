/**
 * BirdRide - Unified Input Component
 * Smart input that handles both RideWithGPS URLs and location search
 */

import { getState, setState } from '../utils/state.js';
import { parseRideWithGPSUrl, isRideWithGPSUrl, fetchRoute, fetchPopularRoutes, formatDistance } from '../services/routeService.js';
import { searchLocations, createDebouncedSearch } from '../services/geocodingService.js';

// UI Elements
let inputEl;
let clearBtn;
let dropdownEl;
let errorEl;
let loadingEl;

// State
let currentView = 'idle'; // 'idle' | 'locations' | 'routes'
let selectedLocation = null;
let locationResults = [];
let popularRoutes = [];

// Debounced location search
let debouncedSearch;

/**
 * Initialize the unified input component
 */
export function initUnifiedInput() {
    // Get DOM elements
    inputEl = document.getElementById('unified-input');
    clearBtn = document.getElementById('clear-input');
    dropdownEl = document.getElementById('input-dropdown');
    errorEl = document.getElementById('input-error');
    loadingEl = document.getElementById('landing-loading');

    // Create debounced search
    debouncedSearch = createDebouncedSearch(handleLocationResults);

    // Bind event listeners
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('focus', handleFocus);
    inputEl.addEventListener('keydown', handleKeyDown);
    clearBtn.addEventListener('click', handleClear);

    // Click outside to close dropdown
    document.addEventListener('click', handleClickOutside);
}

/**
 * Handle input changes
 */
function handleInput(e) {
    const value = e.target.value.trim();

    // Update clear button visibility
    clearBtn.classList.toggle('hidden', !value);

    // Hide error
    hideError();

    if (!value) {
        hideDropdown();
        return;
    }

    // Check if it's a RideWithGPS URL
    if (isRideWithGPSUrl(value)) {
        hideDropdown();
        validateAndLoadRoute(value);
    } else {
        // Treat as location search
        debouncedSearch(value);
    }
}

/**
 * Handle focus on input
 */
function handleFocus() {
    const value = inputEl.value.trim();

    // If we have results, show dropdown
    if (currentView === 'locations' && locationResults.length > 0) {
        showDropdown();
    } else if (currentView === 'routes' && popularRoutes.length > 0) {
        showDropdown();
    }
}

/**
 * Handle keyboard navigation
 */
function handleKeyDown(e) {
    if (e.key === 'Escape') {
        if (currentView === 'routes') {
            // Go back to location search
            goBackToLocations();
        } else {
            hideDropdown();
            inputEl.blur();
        }
    }
}

/**
 * Handle clear button click
 */
function handleClear() {
    inputEl.value = '';
    clearBtn.classList.add('hidden');
    hideDropdown();
    hideError();
    currentView = 'idle';
    selectedLocation = null;
    locationResults = [];
    popularRoutes = [];
    inputEl.focus();
}

/**
 * Handle clicks outside dropdown
 */
function handleClickOutside(e) {
    if (!dropdownEl.contains(e.target) && e.target !== inputEl) {
        hideDropdown();
    }
}

/**
 * Handle location search results
 */
function handleLocationResults(results) {
    locationResults = results;
    currentView = 'locations';

    if (results.length === 0) {
        hideDropdown();
        return;
    }

    renderLocationDropdown(results);
    showDropdown();
}

/**
 * Render location suggestions dropdown
 */
function renderLocationDropdown(locations) {
    dropdownEl.innerHTML = locations.map(loc => `
        <div class="dropdown-item" data-location-id="${loc.id}" data-lat="${loc.lat}" data-lng="${loc.lng}" data-name="${loc.fullName}">
            <span class="dropdown-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            </span>
            <div class="dropdown-item-content">
                <div class="dropdown-item-title">${loc.fullName}</div>
            </div>
        </div>
    `).join('');

    // Bind click handlers
    dropdownEl.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => handleLocationSelect(item));
    });
}

/**
 * Handle location selection
 */
async function handleLocationSelect(item) {
    const location = {
        id: item.dataset.locationId,
        name: item.dataset.name,
        lat: parseFloat(item.dataset.lat),
        lng: parseFloat(item.dataset.lng),
    };

    selectedLocation = location;
    inputEl.value = location.name;
    clearBtn.classList.remove('hidden');

    // Fetch popular routes for this location
    showLoading('Finding popular routes...');

    try {
        popularRoutes = await fetchPopularRoutes(location);
        currentView = 'routes';

        if (popularRoutes.length === 0) {
            hideDropdown();
            showError('No popular routes available for this area. Paste a RideWithGPS link to explore any route.');
        } else {
            renderRoutesDropdown(location, popularRoutes);
            showDropdown();
        }
    } catch (error) {
        console.error('Error fetching routes:', error);
        showError('Failed to load routes. Please try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Render popular routes dropdown
 */
function renderRoutesDropdown(location, routes) {
    const header = `
        <div class="dropdown-header">
            <button class="dropdown-back" id="back-to-locations">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
            </button>
            <span>${location.name.split(',')[0]}</span>
        </div>
    `;

    const routeItems = routes.map(route => `
        <div class="dropdown-item" data-route-id="${route.id}">
            <span class="dropdown-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8v4l2 2"></path>
                </svg>
            </span>
            <div class="dropdown-item-content">
                <div class="dropdown-item-title">${route.name}</div>
                <div class="dropdown-item-subtitle">${route.description}</div>
                ${route.start_location ? `<div class="dropdown-item-subtitle">Starts at ${route.start_location}</div>` : ''}
            </div>
            <span class="dropdown-item-distance">${formatDistance(route.distance)}</span>
        </div>
    `).join('');

    dropdownEl.innerHTML = header + routeItems;

    // Bind back button handler
    document.getElementById('back-to-locations').addEventListener('click', goBackToLocations);

    // Bind route click handlers
    dropdownEl.querySelectorAll('.dropdown-item').forEach(item => {
        if (item.dataset.routeId) {
            item.addEventListener('click', () => handleRouteSelect(item.dataset.routeId));
        }
    });
}

/**
 * Go back to location search
 */
function goBackToLocations() {
    currentView = 'locations';
    selectedLocation = null;
    popularRoutes = [];

    if (locationResults.length > 0) {
        renderLocationDropdown(locationResults);
    } else {
        hideDropdown();
    }
}

/**
 * Handle route selection
 */
async function handleRouteSelect(routeId) {
    hideDropdown();
    showLoading('Loading route...');

    try {
        const routeData = await fetchRoute(routeId);
        loadRoute(routeData);
    } catch (error) {
        console.error('Error loading route:', error);
        showError('Failed to load route. Please try again.');
        hideLoading();
    }
}

/**
 * Validate and load a RideWithGPS URL
 */
async function validateAndLoadRoute(url) {
    const parsed = parseRideWithGPSUrl(url);

    if (!parsed) {
        showError('Enter a RideWithGPS link or search for a city');
        return;
    }

    showLoading('Loading route...');

    try {
        const routeData = await fetchRoute(parsed.id);
        loadRoute(routeData);
    } catch (error) {
        console.error('Error loading route:', error);
        showError('We couldn\'t load that route. Make sure it\'s a public RideWithGPS link.');
        hideLoading();
    }
}

/**
 * Load route and transition to map view
 */
function loadRoute(routeData) {
    setState({
        route: routeData,
        isLoading: true,
    });

    // Dispatch custom event to trigger page transition
    window.dispatchEvent(new CustomEvent('routeLoaded', { detail: routeData }));
}

/**
 * Show dropdown
 */
function showDropdown() {
    dropdownEl.classList.remove('hidden');
}

/**
 * Hide dropdown
 */
function hideDropdown() {
    dropdownEl.classList.add('hidden');
}

/**
 * Show error message
 */
function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
    errorEl.classList.add('hidden');
}

/**
 * Show loading indicator
 */
function showLoading(message = 'Loading...') {
    loadingEl.querySelector('span').textContent = message;
    loadingEl.classList.remove('hidden');
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    loadingEl.classList.add('hidden');
}

/**
 * Reset the input component
 */
export function resetUnifiedInput() {
    inputEl.value = '';
    clearBtn.classList.add('hidden');
    hideDropdown();
    hideError();
    hideLoading();
    currentView = 'idle';
    selectedLocation = null;
    locationResults = [];
    popularRoutes = [];
}
