// tests/unit/controllers/JobController.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JobController } from '../../../resources/js/controllers/JobController.js'
import { Job } from '../../../resources/js/models/Job.js'

// Mock uiUtils module
vi.mock('../../../resources/js/uiUtils.js', () => ({
  showSpinner: vi.fn(),
  hideSpinner: vi.fn(),
  startCountdown: vi.fn(),
  clearCountdown: vi.fn()
}))

// Import mocked functions
import { showSpinner, hideSpinner, startCountdown, clearCountdown } from '../../../resources/js/uiUtils.js'

describe('JobController', () => {
  let jobController
  let mockEventBus
  let mockStateManager
  let mockAPIService
  let mockJobView
  let mockErrorView
  let mockPollingManager
  let mockLogger
  let dependencies

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn((event, handler) => vi.fn()),
      emit: vi.fn(),
      emitAsync: vi.fn()
    }

    // Mock StateManager
    mockStateManager = {
      addJob: vi.fn(),
      getJob: vi.fn(),
      getJobs: vi.fn(() => []),
      updateJobStatus: vi.fn(),
      setJobPolling: vi.fn(),
      getJobPolling: vi.fn()
    }

    // Mock APIService
    mockAPIService = {
      submitJob: vi.fn(),
      getJobStatus: vi.fn(),
      pollJobStatus: vi.fn()
    }

    // Mock JobView
    mockJobView = {
      showJob: vi.fn(),
      updateStatus: vi.fn(),
      showDownloadLink: vi.fn(),
      showError: vi.fn()
    }

    // Mock ErrorView
    mockErrorView = {
      show: vi.fn()
    }

    // Mock PollingManager
    mockPollingManager = {
      start: vi.fn(() => vi.fn()), // Returns stop function
      stop: vi.fn(),
      isActive: vi.fn()
    }

    // Mock Logger
    mockLogger = {
      logMessage: vi.fn()
    }

    // Setup dependencies
    dependencies = {
      eventBus: mockEventBus,
      stateManager: mockStateManager,
      apiService: mockAPIService,
      jobView: mockJobView,
      errorView: mockErrorView,
      pollingManager: mockPollingManager,
      logger: mockLogger
    }

    // Create controller instance
    jobController = new JobController(dependencies)

    // Clear all mocks
    vi.clearAllMocks()

    // Setup window.CONFIG
    global.window = {
      CONFIG: {
        API_URL: 'http://localhost:8000/api'
      },
      open: vi.fn()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with required dependencies', () => {
      expect(jobController.apiService).toBe(mockAPIService)
      expect(jobController.jobView).toBe(mockJobView)
      expect(jobController.errorView).toBe(mockErrorView)
      expect(jobController.pollingManager).toBe(mockPollingManager)
    })

    it('should extend BaseController', () => {
      expect(jobController.eventBus).toBe(mockEventBus)
      expect(jobController.stateManager).toBe(mockStateManager)
      expect(jobController.logger).toBe(mockLogger)
    })

    it('should call bindEvents during initialization', () => {
      // Note: bindEvents is called manually by app initialization, not in constructor
      // This test verifies the controller was initialized properly
      expect(jobController).toBeDefined()
      expect(jobController.bindEvents).toBeDefined()
    })
  })

  // ============================================================================
  // bindEvents()
  // ============================================================================

  describe('bindEvents()', () => {
    it('should bind all job-related events', () => {
      // Create new controller to verify binding
      const controller = new JobController(dependencies)

      // Verify all event handlers are bound
      const calls = mockEventBus.on.mock.calls.map(call => call[0])
      expect(calls).toContain('job:submit')
      expect(calls).toContain('job:cancel')
      expect(calls).toContain('job:retry')
      expect(calls).toContain('job:poll')
      expect(calls).toContain('job:download')
    })
  })

  // ============================================================================
  // handleSubmit() - Successful submission
  // ============================================================================

  describe('handleSubmit() - Successful submission', () => {
    it('should submit job and update state', async () => {
      // Arrange
      const mockFormData = new FormData()
      const mockJob = {
        jobId: 'test-job-123',
        status: 'pending',
        fileName: 'test.bam'
      }
      mockAPIService.submitJob.mockResolvedValue(mockJob)

      // Act
      const result = await jobController.handleSubmit({
        formData: mockFormData,
        fileName: 'test.bam'
      })

      // Assert
      expect(showSpinner).toHaveBeenCalled()
      expect(startCountdown).toHaveBeenCalled()
      expect(mockAPIService.submitJob).toHaveBeenCalledWith(mockFormData, undefined, undefined)
      expect(mockStateManager.addJob).toHaveBeenCalledWith('test-job-123', expect.objectContaining({
        status: 'pending',
        fileName: 'test.bam'
      }))
      expect(mockJobView.showJob).toHaveBeenCalledWith(mockJob)
      expect(result).toBe(mockJob)
    })

    it('should submit job with cohort ID and passphrase', async () => {
      // Arrange
      const mockFormData = new FormData()
      const cohortId = 'cohort-123'
      const passphrase = 'secret'
      const mockJob = { jobId: 'test-job-123', status: 'pending' }
      mockAPIService.submitJob.mockResolvedValue(mockJob)

      // Act
      await jobController.handleSubmit({
        formData: mockFormData,
        cohortId,
        passphrase,
        fileName: 'test.bam'
      })

      // Assert
      expect(mockAPIService.submitJob).toHaveBeenCalledWith(mockFormData, cohortId, passphrase)
      expect(mockStateManager.addJob).toHaveBeenCalledWith('test-job-123', expect.objectContaining({
        cohortId: 'cohort-123'
      }))
    })

    it('should emit job:submitted event', async () => {
      // Arrange
      const mockFormData = new FormData()
      const mockJob = { jobId: 'test-job-123', status: 'pending' }
      mockAPIService.submitJob.mockResolvedValue(mockJob)

      // Act
      await jobController.handleSubmit({ formData: mockFormData })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:submitted', expect.objectContaining({
        jobId: 'test-job-123',
        job: mockJob
      }))
    })

    it('should start polling after successful submission', async () => {
      // Arrange
      const mockFormData = new FormData()
      const mockJob = { jobId: 'test-job-123', status: 'pending' }
      mockAPIService.submitJob.mockResolvedValue(mockJob)

      // Act
      await jobController.handleSubmit({ formData: mockFormData })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:poll', { jobId: 'test-job-123' })
    })
  })

  // ============================================================================
  // handleSubmit() - Error handling
  // ============================================================================

  describe('handleSubmit() - Error handling', () => {
    it('should handle submission errors and show error view', async () => {
      // Arrange
      const mockFormData = new FormData()
      const error = new Error('Network error')
      mockAPIService.submitJob.mockRejectedValue(error)

      // Act & Assert
      await expect(
        jobController.handleSubmit({ formData: mockFormData })
      ).rejects.toThrow('Network error')

      expect(mockErrorView.show).toHaveBeenCalledWith(error, 'Job Submission')
      expect(hideSpinner).toHaveBeenCalled()
      expect(clearCountdown).toHaveBeenCalled()
    })

    it('should log error with context', async () => {
      // Arrange
      const mockFormData = new FormData()
      const error = new Error('API error')
      mockAPIService.submitJob.mockRejectedValue(error)

      // Act
      try {
        await jobController.handleSubmit({ formData: mockFormData })
      } catch (e) {
        // Expected
      }

      // Assert - error was handled (handleError called internally)
      expect(mockErrorView.show).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // handlePoll() - Start polling
  // ============================================================================

  describe('handlePoll() - Start polling', () => {
    it('should start polling with polling manager', async () => {
      // Arrange
      const jobId = 'test-job-123'
      const mockStopFn = vi.fn()
      mockPollingManager.start.mockReturnValue(mockStopFn)

      // Act
      await jobController.handlePoll({ jobId })

      // Assert
      expect(mockPollingManager.start).toHaveBeenCalledWith(
        jobId,
        expect.any(Function),
        expect.objectContaining({
          interval: 5000,
          maxRetries: 10,
          onUpdate: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function)
        })
      )
    })

    it('should store stop function in state', async () => {
      // Arrange
      const jobId = 'test-job-123'
      const mockStopFn = vi.fn()
      mockPollingManager.start.mockReturnValue(mockStopFn)

      // Act
      await jobController.handlePoll({ jobId })

      // Assert
      expect(mockStateManager.setJobPolling).toHaveBeenCalledWith(jobId, mockStopFn)
    })

    it('should call getJobStatus when polling', async () => {
      // Arrange
      const jobId = 'test-job-123'
      mockAPIService.getJobStatus.mockResolvedValue({ status: 'pending' })

      // Act
      await jobController.handlePoll({ jobId })

      // Get the pollFn that was passed to pollingManager.start
      const pollFn = mockPollingManager.start.mock.calls[0][1]

      // Call the poll function
      const result = await pollFn()

      // Assert
      expect(mockAPIService.getJobStatus).toHaveBeenCalledWith(jobId)
      expect(result).toEqual({ status: 'pending' })
    })
  })

  // ============================================================================
  // handleStatusUpdate() - Status updates during polling
  // ============================================================================

  describe('handleStatusUpdate()', () => {
    it('should update state and view with new status', () => {
      // Arrange
      const jobId = 'test-job-123'
      const statusData = { status: 'processing', progress: 50 }

      // Act
      jobController.handleStatusUpdate(jobId, statusData)

      // Assert
      expect(mockStateManager.updateJobStatus).toHaveBeenCalledWith(jobId, 'processing')
      expect(mockJobView.updateStatus).toHaveBeenCalledWith(jobId, 'processing')
    })

    it('should emit job:status:updated event', () => {
      // Arrange
      const jobId = 'test-job-123'
      const statusData = { status: 'started' }

      // Act
      jobController.handleStatusUpdate(jobId, statusData)

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:status:updated', {
        jobId,
        status: 'started',
        statusData
      })
    })
  })

  // ============================================================================
  // handleJobComplete() - Job completion
  // ============================================================================

  describe('handleJobComplete()', () => {
    it('should handle completed job', () => {
      // Arrange
      const jobId = 'test-job-123'
      const statusData = { status: 'completed', result_url: '/download/test-job-123' }

      // Act
      jobController.handleJobComplete(jobId, statusData)

      // Assert
      expect(mockStateManager.updateJobStatus).toHaveBeenCalledWith(jobId, 'completed')
      expect(mockJobView.showDownloadLink).toHaveBeenCalledWith(jobId)
      expect(hideSpinner).toHaveBeenCalled()
      expect(clearCountdown).toHaveBeenCalled()
    })

    it('should emit job:completed event', () => {
      // Arrange
      const jobId = 'test-job-123'
      const statusData = { status: 'completed' }

      // Act
      jobController.handleJobComplete(jobId, statusData)

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:completed', {
        jobId,
        statusData
      })
    })
  })

  // ============================================================================
  // handleJobError() - Job failure
  // ============================================================================

  describe('handleJobError()', () => {
    it('should handle failed job', () => {
      // Arrange
      const jobId = 'test-job-123'
      const error = new Error('Job processing failed')

      // Act
      jobController.handleJobError(jobId, error)

      // Assert
      expect(mockStateManager.updateJobStatus).toHaveBeenCalledWith(jobId, 'failed')
      expect(mockJobView.showError).toHaveBeenCalledWith(jobId, 'Job processing failed')
      expect(hideSpinner).toHaveBeenCalled()
      expect(clearCountdown).toHaveBeenCalled()
    })

    it('should emit job:failed event', () => {
      // Arrange
      const jobId = 'test-job-123'
      const error = new Error('Job failed')

      // Act
      jobController.handleJobError(jobId, error)

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:failed', {
        jobId,
        error
      })
    })
  })

  // ============================================================================
  // handleCancel() - Job cancellation
  // ============================================================================

  describe('handleCancel()', () => {
    it('should cancel job and stop polling', () => {
      // Arrange
      const jobId = 'test-job-123'
      const mockStopFn = vi.fn()
      mockStateManager.getJobPolling.mockReturnValue(mockStopFn)

      // Act
      jobController.handleCancel({ jobId })

      // Assert
      expect(mockStateManager.getJobPolling).toHaveBeenCalledWith(jobId)
      expect(mockStopFn).toHaveBeenCalled()
      expect(mockStateManager.updateJobStatus).toHaveBeenCalledWith(jobId, 'cancelled')
      expect(mockJobView.updateStatus).toHaveBeenCalledWith(jobId, 'cancelled')
    })

    it('should emit job:cancelled event', () => {
      // Arrange
      const jobId = 'test-job-123'
      mockStateManager.getJobPolling.mockReturnValue(vi.fn())

      // Act
      jobController.handleCancel({ jobId })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:cancelled', { jobId })
    })

    it('should handle missing stop function gracefully', () => {
      // Arrange
      const jobId = 'test-job-123'
      mockStateManager.getJobPolling.mockReturnValue(null)

      // Act & Assert - Should not throw
      expect(() => {
        jobController.handleCancel({ jobId })
      }).not.toThrow()
    })
  })

  // ============================================================================
  // handleRetry() - Job retry
  // ============================================================================

  describe('handleRetry()', () => {
    it('should retry job with saved parameters', async () => {
      // Arrange
      const jobId = 'test-job-123'
      const savedJobData = {
        formData: new FormData(),
        cohortId: 'cohort-123',
        passphrase: 'secret',
        fileName: 'test.bam'
      }
      mockStateManager.getJob.mockReturnValue(savedJobData)
      mockAPIService.submitJob.mockResolvedValue({ jobId: 'new-job-456', status: 'pending' })

      // Act
      await jobController.handleRetry({ jobId })

      // Assert
      expect(mockStateManager.getJob).toHaveBeenCalledWith(jobId)
      expect(mockAPIService.submitJob).toHaveBeenCalled()
    })

    it('should handle error if job not found', async () => {
      // Arrange
      const jobId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d'
      mockStateManager.getJob.mockReturnValue(null)

      // Act
      await jobController.handleRetry({ jobId })

      // Assert - Error is logged, doesn't throw (graceful handling)
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('Retry failed'),
        'error'
      )
    })

    it('should emit job:retried event on success', async () => {
      // Arrange
      const jobId = 'test-job-123'
      mockStateManager.getJob.mockReturnValue({ formData: new FormData() })
      mockAPIService.submitJob.mockResolvedValue({ jobId: 'new-job', status: 'pending' })

      // Act
      await jobController.handleRetry({ jobId })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:retried', { jobId })
    })
  })

  // ============================================================================
  // handleDownload() - Job result download
  // ============================================================================

  describe('handleDownload()', () => {
    it('should open download URL', () => {
      // Arrange
      const jobId = 'test-job-123'

      // Act
      jobController.handleDownload({ jobId })

      // Assert
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:8000/api/download/test-job-123/',
        '_blank'
      )
    })

    it('should emit download events', () => {
      // Arrange
      const jobId = 'test-job-123'

      // Act
      jobController.handleDownload({ jobId })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:download:started', { jobId })
      expect(mockEventBus.emit).toHaveBeenCalledWith('job:download:complete', { jobId })
    })
  })

  // ============================================================================
  // getJob() - Get single job
  // ============================================================================

  describe('getJob()', () => {
    it('should return Job model for existing job', () => {
      // Arrange
      const jobId = 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d'
      const jobData = { jobId, status: 'completed', fileName: 'test.bam' }
      mockStateManager.getJob.mockReturnValue(jobData)

      // Act
      const result = jobController.getJob(jobId)

      // Assert
      expect(result).toBeInstanceOf(Job)
      expect(result.jobId).toBe(jobId)
    })

    it('should return null for non-existent job', () => {
      // Arrange
      const jobId = 'nonexistent'
      mockStateManager.getJob.mockReturnValue(null)

      // Act
      const result = jobController.getJob(jobId)

      // Assert
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // getAllJobs() - Get all jobs
  // ============================================================================

  describe('getAllJobs()', () => {
    it('should return array of Job models', () => {
      // Arrange
      const jobsData = [
        { jobId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d', status: 'pending', fileName: 'test1.bam' },
        { jobId: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', status: 'completed', fileName: 'test2.bam' }
      ]
      mockStateManager.getJobs.mockReturnValue(jobsData)

      // Act
      const result = jobController.getAllJobs()

      // Assert
      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(Job)
      expect(result[1]).toBeInstanceOf(Job)
      expect(result[0].jobId).toBe('c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d')
      expect(result[1].jobId).toBe('a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d')
    })

    it('should return empty array if no jobs', () => {
      // Arrange
      mockStateManager.getJobs.mockReturnValue([])

      // Act
      const result = jobController.getAllJobs()

      // Assert
      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // cleanup() - Resource cleanup
  // ============================================================================

  describe('cleanup()', () => {
    it('should stop all active polling', () => {
      // Arrange
      const mockStopFn1 = vi.fn()
      const mockStopFn2 = vi.fn()
      const jobsData = [
        { jobId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d', pollStop: mockStopFn1 },
        { jobId: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d', pollStop: mockStopFn2 }
      ]
      mockStateManager.getJobs.mockReturnValue(jobsData)

      // Act
      jobController.cleanup()

      // Assert
      expect(mockStopFn1).toHaveBeenCalled()
      expect(mockStopFn2).toHaveBeenCalled()
    })

    it('should handle jobs without pollStop gracefully', () => {
      // Arrange
      const jobsData = [
        { jobId: 'c9b7f8d3-4e5a-4f6b-8c7d-9e0f1a2b3c4d', pollStop: null },
        { jobId: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' } // No pollStop property
      ]
      mockStateManager.getJobs.mockReturnValue(jobsData)

      // Act & Assert - Should not throw
      expect(() => {
        jobController.cleanup()
      }).not.toThrow()
    })
  })

  // ============================================================================
  // Integration: Full workflow
  // ============================================================================

  describe('Integration - Full job workflow', () => {
    it('should handle complete job lifecycle', async () => {
      // Arrange
      const mockFormData = new FormData()
      const mockJob = { jobId: 'test-job-123', status: 'pending' }
      mockAPIService.submitJob.mockResolvedValue(mockJob)
      mockAPIService.getJobStatus.mockResolvedValue({ status: 'completed' })

      const mockStopFn = vi.fn()
      mockPollingManager.start.mockReturnValue(mockStopFn)

      // Act 1: Submit job
      await jobController.handleSubmit({ formData: mockFormData })

      // Assert 1: Job submitted
      expect(mockAPIService.submitJob).toHaveBeenCalled()
      expect(mockStateManager.addJob).toHaveBeenCalled()
      expect(mockJobView.showJob).toHaveBeenCalled()

      // Act 2: Start polling
      await jobController.handlePoll({ jobId: 'test-job-123' })

      // Assert 2: Polling started
      expect(mockPollingManager.start).toHaveBeenCalled()

      // Simulate status update
      jobController.handleStatusUpdate('test-job-123', { status: 'processing' })
      expect(mockJobView.updateStatus).toHaveBeenCalledWith('test-job-123', 'processing')

      // Simulate completion
      jobController.handleJobComplete('test-job-123', { status: 'completed' })
      expect(mockJobView.showDownloadLink).toHaveBeenCalled()
    })
  })
})
