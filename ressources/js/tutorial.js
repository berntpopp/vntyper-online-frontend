// frontend/ressources/js/tutorial.js

/**
 * Initializes the In-App Guided Tutorial using Intro.js.
 */
export function initializeTutorial() {
    const startTutorialBtn = document.getElementById("startTutorialBtn");

    if (startTutorialBtn) {
        startTutorialBtn.addEventListener("click", (e) => {
            e.preventDefault();
            startIntroTutorial();
        });
    }
}

/**
 * Starts the Intro.js tutorial and marks it as completed.
 */
function startIntroTutorial() {
    if (typeof introJs === 'undefined') {
        console.error("Intro.js is not loaded. Please ensure Intro.js is included correctly.");
        return;
    }

    introJs().start().oncomplete(() => {
        localStorage.setItem('tutorialCompleted', 'true');
    }).onexit(() => {
        localStorage.setItem('tutorialCompleted', 'true');
    });
}
