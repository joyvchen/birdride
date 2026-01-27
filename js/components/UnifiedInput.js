/**
 * BirdRide - Unified Input Component
 * Handles RideWithGPS URL input and route loading
 */

import { getState, setState } from '../utils/state.js';
import { parseRideWithGPSUrl, isRideWithGPSUrl, fetchRoute } from '../services/routeService.js';

// UI Elements
let inputEl;
let clearBtn;
let errorEl;
let loadingEl;
let loadBtnEl;

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

    // Bind event listeners
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('paste', handlePaste);
    inputEl.addEventListener('keydown', handleKeyDown);
    clearBtn.addEventListener('click', handleClear);
    loadBtnEl.addEventListener('click', handleLoadButtonClick);
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

        if (isRideWithGPSUrl(value)) {
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
        return;
    }

    // Check if it's a RideWithGPS URL
    if (isRideWithGPSUrl(value)) {
        showLoadButton();
    } else {
        hideLoadButton();
    }
}

/**
 * Handle keyboard navigation
 */
function handleKeyDown(e) {
    if (e.key === 'Enter') {
        const value = inputEl.value.trim();
        if (isRideWithGPSUrl(value)) {
            e.preventDefault();
            validateAndLoadRoute(value);
        }
    } else if (e.key === 'Escape') {
        inputEl.blur();
    }
}

/**
 * Handle load button click
 */
function handleLoadButtonClick() {
    const value = inputEl.value.trim();
    if (isRideWithGPSUrl(value)) {
        validateAndLoadRoute(value);
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
    inputEl.focus();
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

    setState({
        route: routeData,
        isLoading: true,
    });

    // Dispatch custom event to trigger page transition
    window.dispatchEvent(new CustomEvent('routeLoaded', { detail: routeData }));
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
 * Reset the input component
 */
export function resetUnifiedInput() {
    inputEl.value = '';
    clearBtn.classList.add('hidden');
    hideError();
    hideLoading();
    loadBtnEl.disabled = true;
}
