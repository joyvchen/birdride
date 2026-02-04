/**
 * BirdRide - Unified Input Component
 * Handles RideWithGPS URL input, location search, and route loading
 */

import { getState, setState } from '../utils/state.js';
import { parseRideWithGPSUrl, isRideWithGPSUrl, fetchRoute } from '../services/routeService.js';

// UI Elements
let inputEl;
let clearBtn;
let errorEl;
let loadingEl;
let loadBtnEl;
let searchDropdown;
let locationResults;
let routeResults;

// State
let debounceTimer = null;
let currentSearchMode = null; // 'location' or 'routes'
let selectedLocation = null;

/**
 * Initialize the unified input component
 */
export function initUnifiedInput() {
    // Get DOM elements
    inputEl = document.getElementById('unified-input');
    clearBtn = document.getElementById('clear-input');
    errorEl = document.getElementById('input-error');
    loadingEl = document.getElementById('landing-loading');
    loadBtnEl = document.getElementById('load-route-btn');
    searchDropdown = document.getElementById('search-dropdown');
    locationResults = document.getElementById('location-results');
    routeResults = document.getElementById('route-results');

    // Bind event listeners
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('paste', handlePaste);
    inputEl.addEventListener('keydown', handleKeyDown);
    inputEl.addEventListener('focus', handleFocus);
    clearBtn.addEventListener('click', handleClear);
    loadBtnEl.addEventListener('click', handleLoadButtonClick);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.unified-input-container')) {
            hideDropdown();
        }
    });
}

/**
 * Check if input looks like a URL
 */
function isUrl(input) {
    return input.includes('ridewithgps.com') || input.startsWith('http');
}

/**
 * Handle paste event - check input after paste completes
 */
function handlePaste() {
    // Use setTimeout to get the value after paste is complete
    setTimeout(() => {
        const value = inputEl.value.trim();
        clearBtn.classList.toggle('hidden', !value);
        hideError();
        hideDropdown();

        // Enable button if there's any input
        if (value) {
            showLoadButton();
        } else {
            hideLoadButton();
        }
    }, 0);
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
        hideLoadButton();
        hideDropdown();
        return;
    }

    // Enable button for any input
    showLoadButton();

    // Check if it's a RideWithGPS URL
    if (isUrl(value)) {
        hideDropdown();
        return;
    }

    // It's a location search - debounce and search

    // Clear previous timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Only search if input is at least 2 characters
    if (value.length >= 2) {
        debounceTimer = setTimeout(() => {
            searchLocations(value);
        }, 300);
    } else {
        hideDropdown();
    }
}

/**
 * Handle focus - show dropdown if we have results
 */
function handleFocus() {
    const value = inputEl.value.trim();
    if (value && !isUrl(value) && value.length >= 2) {
        // Re-trigger search on focus if not a URL
        searchLocations(value);
    }
}

/**
 * Handle keyboard navigation
 */
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const value = inputEl.value.trim();
        if (!value) return;

        // If it's a RideWithGPS URL, load it directly
        if (isRideWithGPSUrl(value)) {
            validateAndLoadRoute(value);
            return;
        }

        // Otherwise, trigger location search
        if (value.length >= 2) {
            searchLocations(value);
        }
    } else if (e.key === 'Escape') {
        hideDropdown();
        inputEl.blur();
    }
}

/**
 * Handle load button click
 */
function handleLoadButtonClick() {
    const value = inputEl.value.trim();
    if (!value) return;

    // If it's a RideWithGPS URL, load it directly
    if (isRideWithGPSUrl(value)) {
        validateAndLoadRoute(value);
        return;
    }

    // Otherwise, trigger location search (show dropdown)
    if (value.length >= 2) {
        searchLocations(value);
    }
}

/**
 * Handle clear button click
 */
function handleClear() {
    inputEl.value = '';
    clearBtn.classList.add('hidden');
    hideError();
    hideLoadButton();
    hideDropdown();
    selectedLocation = null;
    currentSearchMode = null;
    inputEl.focus();
}

/**
 * Search for locations using geocoding API
 */
async function searchLocations(query) {
    currentSearchMode = 'location';
    selectedLocation = null;

    // Show loading state
    showDropdown();
    locationResults.innerHTML = `
        <div class="dropdown-loading">
            <div class="spinner"></div>
            <span>Searching locations...</span>
        </div>
    `;
    routeResults.innerHTML = '';

    try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Geocoding failed');
        }

        const locations = await response.json();

        if (locations.length === 0) {
            locationResults.innerHTML = `
                <div class="dropdown-empty">No locations found</div>
            `;
            return;
        }

        // Render location results
        locationResults.innerHTML = locations.map(loc => `
            <div class="location-item" data-lat="${loc.lat}" data-lng="${loc.lng}" data-name="${escapeHtml(loc.displayName)}">
                <div class="location-item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
                <span class="location-item-text">${escapeHtml(loc.displayName)}</span>
            </div>
        `).join('');

        // Bind click handlers
        locationResults.querySelectorAll('.location-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                const name = item.dataset.name;
                selectLocation(lat, lng, name);
            });
        });

    } catch (error) {
        console.error('Location search error:', error);
        locationResults.innerHTML = `
            <div class="dropdown-empty">Error searching locations</div>
        `;
    }
}

/**
 * Handle location selection - fetch routes for that region
 */
async function selectLocation(lat, lng, name) {
    selectedLocation = { lat, lng, name };
    currentSearchMode = 'routes';

    // Update input to show selected location
    inputEl.value = name.split(',')[0]; // Show just the city name

    // Show loading state for routes
    locationResults.innerHTML = '';
    routeResults.innerHTML = `
        <div class="route-results-header">
            <span class="route-results-back" id="back-to-locations">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
                Back
            </span>
            <span>Popular routes near ${escapeHtml(name.split(',')[0])}</span>
        </div>
        <div class="dropdown-loading">
            <div class="spinner"></div>
            <span>Finding popular routes...</span>
        </div>
    `;

    // Bind back button
    document.getElementById('back-to-locations').addEventListener('click', (e) => {
        e.stopPropagation();
        currentSearchMode = 'location';
        selectedLocation = null;
        inputEl.value = '';
        inputEl.focus();
        hideDropdown();
    });

    try {
        const response = await fetch(`/api/region-routes?lat=${lat}&lng=${lng}`);
        if (!response.ok) {
            throw new Error('Failed to fetch routes');
        }

        const data = await response.json();

        if (!data.routes || data.routes.length === 0) {
            routeResults.innerHTML = `
                <div class="route-results-header">
                    <span class="route-results-back" id="back-to-locations">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        Back
                    </span>
                    <span>Popular routes near ${escapeHtml(name.split(',')[0])}</span>
                </div>
                <div class="dropdown-empty">No popular routes found in this area</div>
            `;
            bindBackButton();
            return;
        }

        // Render route results
        const routeListHtml = data.routes.map(route => `
            <div class="route-item" data-route-id="${route.id}">
                <div class="route-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22,4 12,14.01 9,11.01"></polyline>
                    </svg>
                </div>
                <div class="route-item-info">
                    <div class="route-item-name">${escapeHtml(route.name)}</div>
                    ${route.distance ? `<div class="route-item-meta">${formatDistance(route.distance)}</div>` : ''}
                </div>
            </div>
        `).join('');

        routeResults.innerHTML = `
            <div class="route-results-header">
                <span class="route-results-back" id="back-to-locations">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"></path>
                    </svg>
                    Back
                </span>
                <span>Popular routes near ${escapeHtml(name.split(',')[0])}</span>
            </div>
            ${routeListHtml}
        `;

        bindBackButton();

        // Bind route click handlers
        routeResults.querySelectorAll('.route-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const routeId = item.dataset.routeId;
                loadRouteById(routeId);
            });
        });

    } catch (error) {
        console.error('Route fetch error:', error);
        routeResults.innerHTML = `
            <div class="route-results-header">
                <span class="route-results-back" id="back-to-locations">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"></path>
                    </svg>
                    Back
                </span>
                <span>Popular routes</span>
            </div>
            <div class="dropdown-empty">Error loading routes</div>
        `;
        bindBackButton();
    }
}

/**
 * Bind back button handler
 */
function bindBackButton() {
    const backBtn = document.getElementById('back-to-locations');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentSearchMode = 'location';
            selectedLocation = null;
            inputEl.value = '';
            inputEl.focus();
            hideDropdown();
        });
    }
}

/**
 * Load a route by ID
 */
async function loadRouteById(routeId) {
    hideDropdown();
    showLoading('Loading route...');

    try {
        const routeData = await fetchRoute(routeId);
        loadRoute(routeData);
    } catch (error) {
        console.error('Error loading route:', error);
        showError('Could not load that route.');
        hideLoading();
    }
}

/**
 * Validate and load a RideWithGPS URL
 */
async function validateAndLoadRoute(url) {
    const parsed = parseRideWithGPSUrl(url);

    if (!parsed) {
        showError('Please enter a valid RideWithGPS route link');
        return;
    }

    showLoading('Loading route...');

    try {
        const routeData = await fetchRoute(parsed.id);
        loadRoute(routeData);
    } catch (error) {
        console.error('Error loading route:', error);
        showError('Could not load that route. Make sure it\'s a public RideWithGPS link.');
        hideLoading();
    }
}

/**
 * Load route and transition to map view
 */
function loadRoute(routeData) {
    // Hide loading indicator before transitioning
    hideLoading();
    hideDropdown();

    setState({
        route: routeData,
        isLoading: true,
    });

    // Dispatch custom event to trigger page transition
    window.dispatchEvent(new CustomEvent('routeLoaded', { detail: routeData }));
}

/**
 * Show the search dropdown
 */
function showDropdown() {
    searchDropdown.classList.remove('hidden');
}

/**
 * Hide the search dropdown
 */
function hideDropdown() {
    searchDropdown.classList.add('hidden');
    locationResults.innerHTML = '';
    routeResults.innerHTML = '';
}

/**
 * Enable load button
 */
function showLoadButton() {
    loadBtnEl.disabled = false;
}

/**
 * Disable load button
 */
function hideLoadButton() {
    loadBtnEl.disabled = true;
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
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format distance in meters to miles
 */
function formatDistance(meters) {
    if (!meters) return '';
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
}

/**
 * Reset the input component
 */
export function resetUnifiedInput() {
    inputEl.value = '';
    clearBtn.classList.add('hidden');
    hideError();
    hideLoading();
    hideDropdown();
    loadBtnEl.disabled = true;
    selectedLocation = null;
    currentSearchMode = null;
}
