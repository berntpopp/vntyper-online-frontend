// frontend/resources/js/citations.js

/**
 * Initializes the Citations section by adding event listeners to download buttons.
 */
export function initializeCitations() {
    const downloadButtons = document.querySelectorAll('.download-citation-btn');

    downloadButtons.forEach(button => {
        button.addEventListener('click', () => {
            const format = button.getAttribute('data-format');
            const citation = button.getAttribute('data-citation');

            if (format === 'bibtex') {
                downloadBibTeX(citation);
            }
            // Future formats can be handled here
        });
    });
}

/**
 * Downloads a BibTeX citation.
 * @param {string} bibtex - The BibTeX string.
 */
function downloadBibTeX(bibtex) {
    const blob = new Blob([bibtex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'citation.bib';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
