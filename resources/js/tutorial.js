// frontend/resources/js/tutorial.js

import { logMessage } from './log.js'; // Import the logMessage function

/**
 * Initializes the In-App Guided Tutorial using Intro.js.
 */
export function initializeTutorial() {
    const startTutorialBtn = document.getElementById("startTutorialBtn");

    if (startTutorialBtn) {
        startTutorialBtn.addEventListener("click", (e) => {
            e.preventDefault();
            logMessage('Tutorial start button clicked.', 'info');
            startIntroTutorial();
        });
        logMessage('Tutorial start button event listener initialized.', 'info');
    } else {
        logMessage('Start Tutorial button (#startTutorialBtn) not found in the DOM.', 'warning');
    }
}

/**
 * Starts the Intro.js tutorial and marks it as completed.
 */
function startIntroTutorial() {
    if (typeof introJs === 'undefined') {
        logMessage("Intro.js is not loaded. Please ensure Intro.js is included correctly.", 'error');
        return;
    }

    logMessage('Starting Intro.js tutorial...', 'info');

    introJs()
        .start()
        .oncomplete(() => {
            localStorage.setItem('tutorialCompleted', 'true');
            logMessage('Intro.js tutorial completed successfully.', 'success');
        })
        .onexit(() => {
            localStorage.setItem('tutorialCompleted', 'true');
            logMessage('Intro.js tutorial exited by user.', 'warning');
        });

    logMessage('Intro.js tutorial initiated.', 'info');
}
