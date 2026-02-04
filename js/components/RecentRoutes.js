/**
 * BirdRide - Recent Routes Component
 * Displays recently viewed routes on the landing page
 */

import { getRouteHistory, removeFromHistory, formatHistoryTime } from '../services/routeHistory.js';
import { formatDistance } from '../services/routeService.js';

// UI Elements
let containerEl;
let listEl;
let onSelectCallback;

/**
 * Initialize the recent routes component
 * @param {function} onSelect - Callback when a route is selected
 */
export function initRecentRoutes(onSelect) {
    containerEl = document.getElementById('recent-routes');
    listEl = document.getElementById('recent-routes-list');
    onSelectCallback = onSelect;

    // Render initial state
    renderRecentRoutes();
}

/**
 * Render the recent routes list
 */
export function renderRecentRoutes() {
    const history = getRouteHistory();

    if (history.length === 0) {
        containerEl.classList.add('hidden');
        return;
    }

    containerEl.classList.remove('hidden');

    // Render route cards
    listEl.innerHTML = history.map(route => createRouteCard(route)).join('');

    // Bind click handlers
    listEl.querySelectorAll('.recent-route-card').forEach(card => {
        const routeId = card.dataset.routeId;

        // Click on card to load route
        card.addEventListener('click', (e) => {
            if (e.target.closest('.recent-route-remove')) return;
            if (onSelectCallback) {
                onSelectCallback(routeId);
            }
        });

        // Click on remove button
        const removeBtn = card.querySelector('.recent-route-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromHistory(routeId);
                renderRecentRoutes();
            });
        }
    });
}

/**
 * Create HTML for a route card
 * @param {object} route - Route history entry
 * @returns {string} HTML string
 */
function createRouteCard(route) {
    const distance = formatDistance(route.distance || 0);
    const timeAgo = formatHistoryTime(route.timestamp);

    return `
        <div class="recent-route-card" data-route-id="${route.id}">
            <div class="recent-route-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 17l6-6 4 4 8-8"/>
                    <path d="M17 7h4v4"/>
                </svg>
            </div>
            <div class="recent-route-info">
                <span class="recent-route-name">${escapeHtml(route.name)}</span>
                <span class="recent-route-meta">${distance} · ${timeAgo}</span>
            </div>
            <button class="recent-route-remove" aria-label="Remove from history">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
