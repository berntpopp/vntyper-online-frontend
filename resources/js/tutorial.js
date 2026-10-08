// frontend/resources/js/tutorial.js

import { logMessage } from './log.js'; // Import the logMessage function

import { safeStorage } from './utils/safeStorage.js';
import { loadCdnAsset } from './utils/loadScript.js';
import { t } from './i18n.js';

const INTRO_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/intro.js/4.0.0';

/**
 * Initializes the In-App Guided Tutorial using Intro.js.
 */
export function initializeTutorial() {
  const startTutorialBtn = document.getElementById('startTutorialBtn');

  if (startTutorialBtn) {
    startTutorialBtn.addEventListener('click', e => {
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
async function startIntroTutorial() {
  try {
    await Promise.all([
      loadCdnAsset(
        `${INTRO_CDN}/introjs.min.css`,
        'sha512-631ugrjzlQYCOP9P8BOLEMFspr5ooQwY3rgt8SMUa+QqtVMbY/tniEUOcABHDGjK50VExB4CNc61g5oopGqCEw=='
      ),
      loadCdnAsset(
        `${INTRO_CDN}/intro.min.js`,
        'sha512-+hhhH0eKqYCmXsO28OJE1HHWkgNYwlpceBwmeeDEt5jpCL8jOuqAVunXlZ/WZ4qIluJdwlcv4f5BUIQ/l1w9iw=='
      ),
    ]);
  } catch (error) {
    logMessage(`Intro.js could not be loaded: ${error.message}`, 'error');
    return;
  }

  logMessage('Starting Intro.js tutorial...', 'info');

  introJs()
    .setOptions({ nextLabel: t('Next'), prevLabel: t('Back'), doneLabel: t('Done') })
    .start()
    .oncomplete(() => {
      safeStorage.setItem('tutorialCompleted', 'true');
      logMessage('Intro.js tutorial completed successfully.', 'success');
    })
    .onexit(() => {
      safeStorage.setItem('tutorialCompleted', 'true');
      logMessage('Intro.js tutorial exited by user.', 'warning');
    });

  logMessage('Intro.js tutorial initiated.', 'info');
}
