/**
 * BirdRide - Main Application
 * Coordinates all components and handles page navigation
 */

import { getState, setState, resetState } from './utils/state.js';
import { initUnifiedInput, resetUnifiedInput } from './components/UnifiedInput.js';
import { initMap, displayRoute, invalidateMapSize } from './components/MapView.js';
import { initBirdList } from './components/BirdList.js';
import { initBirdDetail, closeDetail } from './components/BirdDetail.js';
import { initFilterControls, loadBirdData, resetFilters } from './components/FilterControls.js';
import { formatDistance } from './services/routeService.js';

// Page elements
let landingPage;
let mapPage;
let backButton;
let routeNameEl;
let routeDistanceEl;

/**
 * Initialize the application
 */
function init() {
    // Get page elements
    landingPage = document.getElementById('landing-page');
    mapPage = document.getElementById('map-page');
    backButton = document.getElementById('back-button');
    routeNameEl = document.getElementById('route-name');
    routeDistanceEl = document.getElementById('route-distance');

    // Initialize components
    initUnifiedInput();
    initMap();
    initBirdList();
    initBirdDetail();
    initFilterControls();

    // Set up navigation
    backButton.addEventListener('click', navigateToLanding);

    // Listen for route loaded event
    window.addEventListener('routeLoaded', handleRouteLoaded);

    // Handle browser back button
    window.addEventListener('popstate', handlePopState);

    // Check for route in URL on load
    checkUrlForRoute();

    console.log('BirdRide initialized');
}

/**
 * Handle when a route is loaded
 */
async function handleRouteLoaded(event) {
    const routeData = event.detail;

    // Update header with route info
    routeNameEl.textContent = routeData.name || 'Untitled Route';
    routeDistanceEl.textContent = formatDistance(routeData.distance || 0);

    // Navigate to map page
    navigateToMap();

    // Display route on map
    displayRoute(routeData);

    // Update URL
    updateUrl(routeData.id);

    // Load bird data
    await loadBirdData();

    // Update loading state
    setState({ isLoading: false });
}

/**
 * Navigate to the landing page
 */
function navigateToLanding() {
    // Close any open panels
    closeDetail();

    // Show landing page
    landingPage.classList.add('active');
    mapPage.classList.remove('active');

    // Reset state
    resetState();
    resetUnifiedInput();
    resetFilters();

    // Update URL
    history.pushState({ page: 'landing' }, '', '/');

    setState({ currentPage: 'landing' });
}

/**
 * Navigate to the map page
 */
function navigateToMap() {
    // Show map page
    landingPage.classList.remove('active');
    mapPage.classList.add('active');

    // Ensure map renders correctly
    invalidateMapSize();

    setState({ currentPage: 'map' });
}

/**
 * Update URL with route ID
 */
function updateUrl(routeId) {
    const url = `/route/${routeId}`;
    history.pushState({ page: 'map', routeId }, '', url);
}

/**
 * Handle browser back/forward navigation
 */
function handlePopState(event) {
    const state = event.state;

    if (!state || state.page === 'landing') {
        navigateToLanding();
    }
    // If navigating forward to a route, we'd need to reload it
    // For now, just go back to landing
}

/**
 * Check URL for route ID on initial load
 */
function checkUrlForRoute() {
    const path = window.location.pathname;
    const match = path.match(/\/route\/(\d+)/);

    if (match) {
        const routeId = match[1];
        // Load the route
        loadRouteById(routeId);
    }
}

/**
 * Load a route by ID (for direct URL access)
 */
async function loadRouteById(routeId) {
    const { fetchRoute } = await import('./services/routeService.js');

    try {
        setState({ isLoading: true });
        const routeData = await fetchRoute(routeId);

        // Dispatch route loaded event
        window.dispatchEvent(new CustomEvent('routeLoaded', { detail: routeData }));
    } catch (error) {
        console.error('Failed to load route:', error);
        // Stay on landing page
        setState({ isLoading: false });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
