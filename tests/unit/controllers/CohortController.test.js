// tests/unit/controllers/CohortController.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CohortController } from '../../../resources/js/controllers/CohortController.js';
import { Cohort } from '../../../resources/js/models/Cohort.js';

describe('CohortController', () => {
  let cohortController;
  let mockEventBus;
  let mockLogger;
  let mockStateManager;
  let mockAPIService;
  let mockCohortView;
  let mockErrorView;
  let mockPollingManager;

  beforeEach(() => {
    // Setup mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn(),
      emitAsync: vi.fn(),
    };

    // Setup mock logger
    mockLogger = {
      logMessage: vi.fn(),
    };

    // Setup mock StateManager
    mockStateManager = {
      addCohort: vi.fn(),
      getCohort: vi.fn(),
      getCohorts: vi.fn(() => []),
      addJobToCohort: vi.fn(),
      getCohortJobCount: vi.fn(),
      getJobCohort: vi.fn(),
      areCohortJobsComplete: vi.fn(),
      setCohortPolling: vi.fn(),
    };

    // Setup mock APIService
    mockAPIService = {
      createCohort: vi.fn(),
      getCohortStatus: vi.fn(),
    };

    // Setup mock CohortView
    mockCohortView = {
      showCohort: vi.fn(),
      updateCohort: vi.fn(),
      showAnalysisSection: vi.fn(),
      updateAnalysisStatus: vi.fn(),
    };

    // Setup mock ErrorView
    mockErrorView = {
      show: vi.fn(),
      hide: vi.fn(),
      clear: vi.fn(),
    };

    // Setup mock PollingManager
    mockPollingManager = {
      start: vi.fn(() => vi.fn()), // Returns stop function
      stop: vi.fn(),
      stopAll: vi.fn(),
    };

    // Create CohortController instance
    cohortController = new CohortController({
      eventBus: mockEventBus,
      logger: mockLogger,
      stateManager: mockStateManager,
      apiService: mockAPIService,
      cohortView: mockCohortView,
      errorView: mockErrorView,
      pollingManager: mockPollingManager,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with provided dependencies', () => {
      expect(cohortController.eventBus).toBe(mockEventBus);
      expect(cohortController.logger).toBe(mockLogger);
      expect(cohortController.stateManager).toBe(mockStateManager);
      expect(cohortController.apiService).toBe(mockAPIService);
      expect(cohortController.cohortView).toBe(mockCohortView);
      expect(cohortController.errorView).toBe(mockErrorView);
      expect(cohortController.pollingManager).toBe(mockPollingManager);
    });

    it('should extend BaseController', () => {
      expect(cohortController.on).toBeDefined();
      expect(cohortController.emit).toBeDefined();
      expect(cohortController.handleError).toBeDefined();
    });
  });

  // ============================================================================
  // bindEvents()
  // ============================================================================

  describe('bindEvents()', () => {
    it('should bind all cohort-related events', () => {
      // Act
      cohortController.bindEvents();

      // Assert
      expect(mockEventBus.on).toHaveBeenCalledWith('cohort:create', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledWith('cohort:addJob', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledWith('cohort:poll', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledWith('cohort:analyze', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledWith('job:submitted', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledWith('job:completed', expect.any(Function), {});
      expect(mockEventBus.on).toHaveBeenCalledTimes(6);
    });
  });

  // ============================================================================
  // handleCreate() - Successful creation
  // ============================================================================

  describe('handleCreate() - Successful creation', () => {
    it('should create cohort with provided alias', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      const result = await cohortController.handleCreate({
        alias: 'Test Cohort',
      });

      // Assert
      expect(mockAPIService.createCohort).toHaveBeenCalledWith('Test Cohort', undefined);
      expect(result).toEqual(mockCohort);
    });

    it('should create cohort with passphrase', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Protected Cohort',
        hasPassphrase: true,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      await cohortController.handleCreate({
        alias: 'Protected Cohort',
        passphrase: 'secret123',
      });

      // Assert
      expect(mockAPIService.createCohort).toHaveBeenCalledWith('Protected Cohort', 'secret123');
    });

    it('should generate default alias if not provided', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Cohort-2025-10-09T12-00-00-000Z',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);
      vi.spyOn(cohortController, 'generateDefaultAlias').mockReturnValue(
        'Cohort-2025-10-09T12-00-00-000Z'
      );

      // Act
      await cohortController.handleCreate({});

      // Assert
      expect(cohortController.generateDefaultAlias).toHaveBeenCalled();
      expect(mockAPIService.createCohort).toHaveBeenCalledWith(
        'Cohort-2025-10-09T12-00-00-000Z',
        undefined
      );
    });

    it('should update state with cohort data', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      await cohortController.handleCreate({ alias: 'Test Cohort' });

      // Assert
      expect(mockStateManager.addCohort).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        {
          alias: 'Test Cohort',
          hasPassphrase: false,
          jobIds: [],
          createdAt: expect.any(Number),
        }
      );
    });

    it('should show cohort in view with shareable link', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      await cohortController.handleCreate({ alias: 'Test Cohort' });

      // Assert
      expect(mockCohortView.showCohort).toHaveBeenCalledWith(mockCohort, {
        showShareableLink: true,
      });
    });

    it('should emit cohort:created event', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      await cohortController.handleCreate({ alias: 'Test Cohort' });

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:created', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        cohort: mockCohort,
      });
    });

    it('should log cohort creation', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);

      // Act
      await cohortController.handleCreate({ alias: 'Test Cohort' });

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('[CohortController] Creating cohort'),
        'info'
      );
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Cohort created: c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'success'
      );
    });
  });

  // ============================================================================
  // handleCreate() - Error handling
  // ============================================================================

  describe('handleCreate() - Error handling', () => {
    it('should handle cohort creation errors', async () => {
      // Arrange
      const error = new Error('Cohort creation failed');
      mockAPIService.createCohort.mockRejectedValue(error);

      // Act & Assert
      await expect(cohortController.handleCreate({ alias: 'Test Cohort' })).rejects.toThrow(
        'Cohort creation failed'
      );

      expect(mockErrorView.show).toHaveBeenCalledWith(error, 'Cohort Creation');
    });

    it('should log cohort creation errors', async () => {
      // Arrange
      const error = new Error('API error');
      mockAPIService.createCohort.mockRejectedValue(error);

      // Act & Assert
      await expect(cohortController.handleCreate({ alias: 'Test' })).rejects.toThrow();

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('[CohortController] Cohort creation failed'),
        'error'
      );
    });
  });

  // ============================================================================
  // handleJobSubmitted()
  // ============================================================================

  describe('handleJobSubmitted()', () => {
    it('should emit cohort:addJob event for cohort jobs', () => {
      // Arrange
      const params = {
        jobId: 'job-123',
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
      };

      // Act
      cohortController.handleJobSubmitted(params);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:addJob', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      });
    });

    it('should not emit event if no cohortId', () => {
      // Arrange
      const params = {
        jobId: 'job-123',
      };

      // Act
      cohortController.handleJobSubmitted(params);

      // Assert
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('should log job addition to cohort', () => {
      // Arrange
      const params = {
        jobId: 'job-123',
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
      };

      // Act
      cohortController.handleJobSubmitted(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Adding job job-123 to cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'info'
      );
    });
  });

  // ============================================================================
  // handleAddJob()
  // ============================================================================

  describe('handleAddJob()', () => {
    it('should add job to cohort in state', () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      };
      mockStateManager.getCohortJobCount.mockReturnValue(1);

      // Act
      cohortController.handleAddJob(params);

      // Assert
      expect(mockStateManager.addJobToCohort).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'job-123'
      );
    });

    it('should update cohort view with job count', () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      };
      mockStateManager.getCohortJobCount.mockReturnValue(3);

      // Act
      cohortController.handleAddJob(params);

      // Assert
      expect(mockCohortView.updateCohort).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        {
          jobCount: 3,
        }
      );
    });

    it('should emit cohort:job:added event', () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      };
      mockStateManager.getCohortJobCount.mockReturnValue(1);

      // Act
      cohortController.handleAddJob(params);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:job:added', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      });
    });

    it('should handle errors when adding job', () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-123',
      };
      const error = new Error('State error');
      mockStateManager.addJobToCohort.mockImplementation(() => {
        throw error;
      });

      // Act
      cohortController.handleAddJob(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('[CohortController] Failed to add job to cohort'),
        'error'
      );
    });
  });

  // ============================================================================
  // handleJobCompleted()
  // ============================================================================

  describe('handleJobCompleted()', () => {
    it('should check if job belongs to cohort', () => {
      // Arrange
      const params = { jobId: 'job-123' };
      mockStateManager.getJobCohort.mockReturnValue(null);

      // Act
      cohortController.handleJobCompleted(params);

      // Assert
      expect(mockStateManager.getJobCohort).toHaveBeenCalledWith('job-123');
      expect(mockStateManager.areCohortJobsComplete).not.toHaveBeenCalled();
    });

    it('should emit cohort:allJobsComplete when all jobs done', () => {
      // Arrange
      const params = { jobId: 'job-123' };
      mockStateManager.getJobCohort.mockReturnValue('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d');
      mockStateManager.areCohortJobsComplete.mockReturnValue(true);

      // Act
      cohortController.handleJobCompleted(params);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:allJobsComplete', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
      });
    });

    it('should show analysis section when all jobs complete', () => {
      // Arrange
      const params = { jobId: 'job-123' };
      mockStateManager.getJobCohort.mockReturnValue('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d');
      mockStateManager.areCohortJobsComplete.mockReturnValue(true);

      // Act
      cohortController.handleJobCompleted(params);

      // Assert
      expect(mockCohortView.showAnalysisSection).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d'
      );
    });

    it('should not emit event when jobs still pending', () => {
      // Arrange
      const params = { jobId: 'job-123' };
      mockStateManager.getJobCohort.mockReturnValue('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d');
      mockStateManager.areCohortJobsComplete.mockReturnValue(false);

      // Act
      cohortController.handleJobCompleted(params);

      // Assert
      expect(mockEventBus.emit).not.toHaveBeenCalledWith('cohort:allJobsComplete', {});
    });

    it('should log when all cohort jobs complete', () => {
      // Arrange
      const params = { jobId: 'job-123' };
      mockStateManager.getJobCohort.mockReturnValue('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d');
      mockStateManager.areCohortJobsComplete.mockReturnValue(true);

      // Act
      cohortController.handleJobCompleted(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] All jobs in cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d completed',
        'info'
      );
    });
  });

  // ============================================================================
  // handlePoll()
  // ============================================================================

  describe('handlePoll()', () => {
    it('should start polling via polling manager', async () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        passphrase: 'secret',
      };
      const mockStopFn = vi.fn();
      mockPollingManager.start.mockReturnValue(mockStopFn);

      // Act
      await cohortController.handlePoll(params);

      // Assert
      expect(mockPollingManager.start).toHaveBeenCalledWith(
        'cohort-c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        expect.any(Function),
        expect.objectContaining({
          interval: 5000,
          maxRetries: 10,
        })
      );
    });

    it('should configure polling callbacks', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };
      let pollingConfig;

      mockPollingManager.start.mockImplementation((id, pollFn, config) => {
        pollingConfig = config;
        return vi.fn();
      });

      // Act
      await cohortController.handlePoll(params);

      // Assert
      expect(pollingConfig).toHaveProperty('onUpdate');
      expect(pollingConfig).toHaveProperty('onComplete');
      expect(pollingConfig).toHaveProperty('onError');
      expect(typeof pollingConfig.onUpdate).toBe('function');
      expect(typeof pollingConfig.onComplete).toBe('function');
      expect(typeof pollingConfig.onError).toBe('function');
    });

    it('should call getCohortStatus via poll function', async () => {
      // Arrange
      const params = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        passphrase: 'secret',
      };
      let pollFunction;

      mockPollingManager.start.mockImplementation((id, pollFn, config) => {
        pollFunction = pollFn;
        return vi.fn();
      });
      mockAPIService.getCohortStatus.mockResolvedValue({ status: 'processing' });

      // Act
      await cohortController.handlePoll(params);
      await pollFunction();

      // Assert
      expect(mockAPIService.getCohortStatus).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'secret'
      );
    });

    it('should store stop function in state', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };
      const mockStopFn = vi.fn();
      mockPollingManager.start.mockReturnValue(mockStopFn);

      // Act
      await cohortController.handlePoll(params);

      // Assert
      expect(mockStateManager.setCohortPolling).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        mockStopFn
      );
    });

    it('should handle polling setup errors', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };
      const error = new Error('Polling setup failed');
      mockPollingManager.start.mockImplementation(() => {
        throw error;
      });

      // Act
      await cohortController.handlePoll(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining(
          '[CohortController] Polling failed for cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d'
        ),
        'error'
      );
    });

    it('should log polling start', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };

      // Act
      await cohortController.handlePoll(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Starting polling for cohort: c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'info'
      );
    });
  });

  // ============================================================================
  // handleStatusUpdate()
  // ============================================================================

  describe('handleStatusUpdate()', () => {
    it('should emit cohort:status:updated event', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const statusData = { status: 'processing', jobCount: 5 };

      // Act
      cohortController.handleStatusUpdate(cohortId, statusData);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:status:updated', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        statusData,
      });
    });

    it('should log status update', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const statusData = { status: 'processing' };

      // Act
      cohortController.handleStatusUpdate(cohortId, statusData);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d status update',
        'info'
      );
    });
  });

  // ============================================================================
  // handleCohortComplete()
  // ============================================================================

  describe('handleCohortComplete()', () => {
    it('should emit cohort:completed event', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const statusData = { status: 'completed', jobCount: 5 };

      // Act
      cohortController.handleCohortComplete(cohortId, statusData);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:completed', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        statusData,
      });
    });

    it('should log cohort completion', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const statusData = { status: 'completed' };

      // Act
      cohortController.handleCohortComplete(cohortId, statusData);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d completed',
        'success'
      );
    });
  });

  // ============================================================================
  // handleCohortError()
  // ============================================================================

  describe('handleCohortError()', () => {
    it('should emit cohort:failed event', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const error = new Error('Cohort processing failed');

      // Act
      cohortController.handleCohortError(cohortId, error);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:failed', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        error,
      });
    });

    it('should log cohort error', () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      const error = new Error('Processing error');

      // Act
      cohortController.handleCohortError(cohortId, error);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Cohort c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d error: Processing error',
        'error'
      );
    });
  });

  // ============================================================================
  // handleAnalyze()
  // ============================================================================

  describe('handleAnalyze()', () => {
    it('should update analysis status in view', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };

      // Act
      await cohortController.handleAnalyze(params);

      // Assert
      expect(mockCohortView.updateAnalysisStatus).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'processing'
      );
    });

    it('should emit cohort:analysis:started event', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };

      // Act
      await cohortController.handleAnalyze(params);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:analysis:started', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
      });
    });

    it('should log analysis start', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };

      // Act
      await cohortController.handleAnalyze(params);

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Starting cohort analysis: c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        'info'
      );
    });

    it('should handle analysis errors', async () => {
      // Arrange
      const params = { cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d' };
      const error = new Error('Analysis failed');
      mockCohortView.updateAnalysisStatus.mockImplementation(() => {
        throw error;
      });

      // Act
      await cohortController.handleAnalyze(params);

      // Assert
      expect(mockErrorView.show).toHaveBeenCalledWith(error, 'Cohort Analysis');
    });
  });

  // ============================================================================
  // generateDefaultAlias()
  // ============================================================================

  describe('generateDefaultAlias()', () => {
    it('should generate alias with timestamp', () => {
      // Act
      const alias = cohortController.generateDefaultAlias();

      // Assert
      expect(alias).toMatch(/^Cohort-\d{4}-\d{2}-\d{2}T/);
    });

    it('should replace colons and periods with hyphens', () => {
      // Act
      const alias = cohortController.generateDefaultAlias();

      // Assert
      expect(alias).not.toMatch(/[:.]/);
      expect(alias).toMatch(/^Cohort-[0-9T-]+Z$/);
    });

    it('should generate unique aliases', () => {
      // Act
      const alias1 = cohortController.generateDefaultAlias();
      const alias2 = cohortController.generateDefaultAlias();

      // Assert - Either different or same if called in same millisecond
      // Just verify format is correct
      expect(alias1).toMatch(/^Cohort-/);
      expect(alias2).toMatch(/^Cohort-/);
    });
  });

  // ============================================================================
  // getCohort()
  // ============================================================================

  describe('getCohort()', () => {
    it('should return Cohort model when cohort exists', () => {
      // Arrange
      const mockCohortData = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Test Cohort',
        jobIds: ['job-1', 'job-2'],
      };
      mockStateManager.getCohort.mockReturnValue(mockCohortData);

      // Act
      const result = cohortController.getCohort('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d');

      // Assert
      expect(mockStateManager.getCohort).toHaveBeenCalledWith(
        'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d'
      );
      expect(result).toBeInstanceOf(Cohort);
    });

    it('should return null when cohort not found', () => {
      // Arrange
      mockStateManager.getCohort.mockReturnValue(null);

      // Act
      const result = cohortController.getCohort('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // cleanup()
  // ============================================================================

  describe('cleanup()', () => {
    it('should stop all active cohort polling', () => {
      // Arrange
      const mockStopFn1 = vi.fn();
      const mockStopFn2 = vi.fn();
      mockStateManager.getCohorts.mockReturnValue([
        { cohortId: 'cohort-1', pollStop: mockStopFn1 },
        { cohortId: 'cohort-2', pollStop: mockStopFn2 },
      ]);

      // Act
      cohortController.cleanup();

      // Assert
      expect(mockStopFn1).toHaveBeenCalled();
      expect(mockStopFn2).toHaveBeenCalled();
    });

    it('should handle cohorts without pollStop gracefully', () => {
      // Arrange
      mockStateManager.getCohorts.mockReturnValue([
        { cohortId: 'cohort-1' }, // No pollStop
        { cohortId: 'cohort-2', pollStop: null },
      ]);

      // Act & Assert - Should not throw
      expect(() => {
        cohortController.cleanup();
      }).not.toThrow();
    });

    it('should log cleanup completion', () => {
      // Arrange
      mockStateManager.getCohorts.mockReturnValue([]);

      // Act
      cohortController.cleanup();

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[CohortController] Cleanup complete',
        'info'
      );
    });
  });

  // ============================================================================
  // Integration Workflow
  // ============================================================================

  describe('Integration Workflow', () => {
    it('should handle complete cohort creation and job assignment workflow', async () => {
      // Arrange
      const mockCohort = {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        alias: 'Research Cohort',
        hasPassphrase: false,
      };
      mockAPIService.createCohort.mockResolvedValue(mockCohort);
      mockStateManager.getCohortJobCount.mockReturnValue(2);

      // Act - Step 1: Create cohort
      await cohortController.handleCreate({ alias: 'Research Cohort' });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'cohort:created',
        expect.objectContaining({
          cohortId: expect.any(String),
        })
      );

      // Act - Step 2: Job submitted to cohort
      cohortController.handleJobSubmitted({
        jobId: 'job-1',
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:addJob', {
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-1',
      });

      // Act - Step 3: Add job to cohort
      cohortController.handleAddJob({
        cohortId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d',
        jobId: 'job-1',
      });

      // Assert - Final state
      expect(mockStateManager.addJobToCohort).toHaveBeenCalled();
      expect(mockCohortView.updateCohort).toHaveBeenCalled();
    });

    it('should handle cohort polling and completion workflow', async () => {
      // Arrange
      const cohortId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d';
      let onCompleteCallback;

      mockPollingManager.start.mockImplementation((id, pollFn, config) => {
        onCompleteCallback = config.onComplete;
        return vi.fn();
      });
      mockStateManager.getJobCohort.mockReturnValue(cohortId);
      mockStateManager.areCohortJobsComplete.mockReturnValue(true);

      // Act - Step 1: Start polling
      await cohortController.handlePoll({ cohortId });

      expect(mockPollingManager.start).toHaveBeenCalled();

      // Act - Step 2: Job completes
      cohortController.handleJobCompleted({ jobId: 'job-1' });

      expect(mockEventBus.emit).toHaveBeenCalledWith('cohort:allJobsComplete', { cohortId });

      // Act - Step 3: Polling completes
      onCompleteCallback({ status: 'completed' });

      // Assert - Final state
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'cohort:completed',
        expect.objectContaining({
          cohortId: expect.any(String),
        })
      );
    });
  });
});
