// frontend/resources/js/footer.js

/**
 * Initializes the footer functionality by generating footer content and setting the current year.
 */
export function initializeFooter() {
    generateFooter();
    setCurrentYear();
}

/**
 * Dynamically generates the footer institution logos and links.
 */
function generateFooter() {
    const institutions = window.CONFIG.institutions || [];

    // Get the container elements
    const institutionLogosDiv = document.getElementById('institutionLogos');
    const footerLinksDiv = document.getElementById('footerLinks');

    // Clear existing content to avoid duplication
    institutionLogosDiv.innerHTML = '';
    footerLinksDiv.innerHTML = '';

    // Generate Institution Logos
    institutions.forEach(inst => {
        const link = document.createElement('a');
        link.href = inst.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const img = document.createElement('img');

        // Use external WebP file instead of base64
        img.src = `/resources/assets/logos/${inst.logo}`;

        img.alt = inst.alt || `${inst.name} Logo`;
        img.classList.add('institution-logo', 'me-3', 'mb-3');

        // Set explicit dimensions (prevents layout shift)
        img.width = parseInt(inst.width);
        img.height = parseInt(inst.height);

        // Native lazy loading (browser-optimized)
        img.loading = 'lazy';

        // Handle load event for smooth transition
        img.addEventListener('load', () => {
            img.classList.add('logo-loaded');
        });

        link.appendChild(img);
        institutionLogosDiv.appendChild(link);
    });
}

/**
 * Sets the current year in the footer.
 */
function setCurrentYear() {
    const currentYear = new Date().getFullYear();
    const currentYearSpan = document.getElementById('currentYear');
    if (currentYearSpan) {
        currentYearSpan.textContent = currentYear;
    }
}
