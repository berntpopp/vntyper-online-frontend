// frontend/resources/js/main.js - Refactored with SOLID principles

// Core Infrastructure
import { eventBus } from './utils/EventBus.js';
import { container } from './utils/DI.js';

// Services
import { APIService } from './services/APIService.js';

// Views
import { JobView } from './views/JobView.js';
import { CohortView } from './views/CohortView.js';
import { ErrorView } from './views/ErrorView.js';

// Controllers
import { AppController } from './controllers/AppController.js';
import { JobController } from './controllers/JobController.js';
import { CohortController } from './controllers/CohortController.js';
import { FileController } from './controllers/FileController.js';
import { ExtractionController } from './controllers/ExtractionController.js';

// State Management
import { stateManager } from './stateManager.js';
import { pollingManager } from './pollingManager.js';

// UI Initialization Modules
import { initializeModal } from './modal.js';
import { initializeFooter } from './footer.js';
import { initializeDisclaimer } from './disclaimer.js';
import { initializeFAQ } from './faq.js';
import { initializeUserGuide } from './userGuide.js';
import { initializeCitations } from './citations.js';
import { initializeTutorial } from './tutorial.js';
import { initializeUsageStats } from './usageStats.js';
import { initializeUIUtils } from './uiUtils.js';
import { initializeLogging, logMessage } from './log.js';
import { initializeFileSelection } from './fileSelection.js';
import { initializeServerLoad } from './serverLoad.js';

/**
 * Run an optional feature initializer.
 *
 * A failure here degrades one feature; it must never stop the application from
 * starting. Previously every initializer shared one try block, so a single
 * throw - e.g. blocked localStorage inside initializeLogging - skipped file
 * selection, dependency registration and every controller. The page rendered
 * completely and nothing worked.
 *
 * @param {string} name - Feature name, for the log
 * @param {Function} fn - Initializer to run
 */
function initOptional(name, fn) {
  try {
    fn();
  } catch (error) {
    logMessage(`Optional feature "${name}" failed to initialize: ${error.message}`, 'warning');
  }
}

/**
 * Main Application Initialization
 * Refactored to follow SOLID principles with dependency injection
 */
async function initializeApp() {
  try {
    logMessage('Starting application initialization...', 'info');

    // Initialize UI components (existing modules).
    // These are optional: losing one costs one feature, not the app.
    initOptional('modal', initializeModal);
    initOptional('footer', initializeFooter);
    initOptional('disclaimer', initializeDisclaimer);
    initOptional('faq', initializeFAQ);
    initOptional('userGuide', initializeUserGuide);
    initOptional('citations', initializeCitations);
    initOptional('tutorial', initializeTutorial);
    initOptional('uiUtils', initializeUIUtils);
    initOptional('logging', initializeLogging);
    initOptional('usageStats', initializeUsageStats);

    // Initialize file selection (existing module with selectedFiles array).
    // Fatal: selectedFiles is injected into the DI container, so without it
    // the app cannot accept input at all.
    const selectedFiles = [];
    const fileSelection = initializeFileSelection(selectedFiles);

    // Initialize server load monitoring (optional: a nav indicator)
    initOptional('serverLoad', initializeServerLoad);

    // Register dependencies in DI container
    registerDependencies(selectedFiles, fileSelection);

    // Create and initialize controllers
    const controllers = createControllers();

    // Store controllers globally for debugging
    window.__controllers = controllers;

    // Start the application (handles URL routing after all dependencies are ready)
    controllers.app.start();

    logMessage('Application initialized successfully', 'success');
  } catch (error) {
    logMessage(`Application initialization failed: ${error.message}`, 'error');
  }
}

/**
 * Register all dependencies in the DI container
 */
function registerDependencies(selectedFiles, fileSelection) {
  // Core infrastructure
  container.registerSingleton('eventBus', eventBus);
  container.registerSingleton('stateManager', stateManager);
  container.registerSingleton('pollingManager', pollingManager);
  container.registerSingleton('logger', { logMessage });

  // File selection state (shared with existing fileSelection module)
  container.registerSingleton('selectedFiles', selectedFiles);
  container.registerSingleton('fileSelection', fileSelection);

  // Services
  container.registerSingleton(
    'apiService',
    () =>
      new APIService({
        config: window.CONFIG,
        logger: { logMessage },
      })
  );

  // Views
  container.registerSingleton('jobView', () => new JobView());
  container.registerSingleton('cohortView', () => new CohortView());
  container.registerSingleton('errorView', () => new ErrorView());
}

/**
 * Create and wire up all controllers with dependencies
 */
function createControllers() {
  const deps = container.resolveMany([
    'eventBus',
    'stateManager',
    'pollingManager',
    'apiService',
    'jobView',
    'cohortView',
    'errorView',
    'logger',
    'selectedFiles',
    'fileSelection',
  ]);

  const fileController = new FileController({ ...deps });
  const extractionController = new ExtractionController({ ...deps });
  const jobController = new JobController({ ...deps });
  const cohortController = new CohortController({ ...deps });

  const appController = new AppController({
    ...deps,
    jobController,
    cohortController,
    fileController,
    extractionController,
  });

  return {
    app: appController,
    job: jobController,
    cohort: cohortController,
    file: fileController,
    extraction: extractionController,
  };
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
