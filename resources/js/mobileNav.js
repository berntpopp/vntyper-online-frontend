// frontend/resources/js/mobileNav.js

import { logMessage } from './log.js';

/**
 * Mobile Navigation Toggle Module
 * Handles hamburger menu functionality for mobile devices < 768px
 *
 * Features:
 * - Toggle menu open/closed with hamburger button
 * - Close menu on Escape key
 * - Close menu when clicking outside
 * - Close menu when clicking menu items
 * - Prevent body scroll when menu open
 * - Restore scroll position when menu closes
 * - Focus management for accessibility
 * - Window resize handling
 */

class MobileNavigation {
    constructor() {
        this.navbarToggle = document.querySelector('.navbar-toggle');
        this.navbarMenu = document.querySelector('.navbar-menu');
        this.hamburgerIcon = document.querySelector('.hamburger-icon');
        this.body = document.body;
        this.scrollPosition = 0;

        this.init();
    }

    /**
     * Initialize mobile navigation
     */
    init() {
        if (!this.navbarToggle || !this.navbarMenu) {
            logMessage('Mobile navigation elements not found - skipping initialization', 'warning');
            return;
        }

        this.setupEventListeners();
        logMessage('Mobile navigation initialized successfully', 'info');
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Hamburger button click
        this.navbarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close menu when clicking menu items
        this.navbarMenu.querySelectorAll('.navbar-link').forEach(link => {
            link.addEventListener('click', () => {
                if (this.isMenuOpen()) {
                    this.closeMenu();
                }
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isMenuOpen()) {
                if (!this.navbarMenu.contains(e.target) && !this.navbarToggle.contains(e.target)) {
                    this.closeMenu();
                }
            }
        });

        // Close menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMenuOpen()) {
                this.closeMenu();
                this.navbarToggle.focus(); // Return focus to toggle button
            }
        });

        // Handle window resize (close menu if resizing to desktop)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth > 768 && this.isMenuOpen()) {
                    this.closeMenu();
                }
            }, 250);
        });
    }

    /**
     * Check if menu is currently open
     * @returns {boolean}
     */
    isMenuOpen() {
        return this.navbarToggle.getAttribute('aria-expanded') === 'true';
    }

    /**
     * Toggle menu open/closed
     */
    toggleMenu() {
        if (this.isMenuOpen()) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    /**
     * Open the menu
     */
    openMenu() {
        // Save scroll position
        this.scrollPosition = window.pageYOffset;

        // Update UI
        this.navbarMenu.classList.add('active');
        this.navbarToggle.setAttribute('aria-expanded', 'true');
        this.hamburgerIcon.textContent = '✕';

        // Prevent body scroll
        this.body.classList.add('menu-open');
        this.body.style.top = `-${this.scrollPosition}px`;

        // Focus first menu item for keyboard users
        const firstLink = this.navbarMenu.querySelector('.navbar-link');
        if (firstLink) {
            setTimeout(() => firstLink.focus(), 100);
        }

        logMessage('Mobile menu opened', 'debug');
    }

    /**
     * Close the menu
     */
    closeMenu() {
        // Update UI
        this.navbarMenu.classList.remove('active');
        this.navbarToggle.setAttribute('aria-expanded', 'false');
        this.hamburgerIcon.textContent = '☰';

        // Restore body scroll
        this.body.classList.remove('menu-open');
        this.body.style.top = '';
        window.scrollTo(0, this.scrollPosition);

        logMessage('Mobile menu closed', 'debug');
    }
}

/**
 * Initialize mobile navigation when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    new MobileNavigation();
});
