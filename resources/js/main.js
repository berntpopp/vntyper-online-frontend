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
 * Main Application Initialization
 * Refactored to follow SOLID principles with dependency injection
 */
async function initializeApp() {
    try {
        logMessage('Starting application initialization...', 'info');

        // Initialize UI components (existing modules)
        initializeModal();
        initializeFooter();
        initializeDisclaimer();
        initializeFAQ();
        initializeUserGuide();
        initializeCitations();
        initializeTutorial();
        initializeUIUtils();
        initializeLogging();
        initializeUsageStats();

        // Initialize file selection (existing module with selectedFiles array)
        const selectedFiles = [];
        const fileSelection = initializeFileSelection(selectedFiles);

        // Initialize server load monitoring
        initializeServerLoad();

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
        console.error('Failed to initialize application:', error);
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
    container.registerSingleton('apiService', () => new APIService({
        config: window.CONFIG,
        logger: { logMessage }
    }));

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
        'fileSelection'
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
        extractionController
    });

    return {
        app: appController,
        job: jobController,
        cohort: cohortController,
        file: fileController,
        extraction: extractionController
    };
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
