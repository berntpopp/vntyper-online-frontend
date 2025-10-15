// tests/unit/services/APIService.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { APIService } from '../../../resources/js/services/APIService.js'
import { Job } from '../../../resources/js/models/Job.js'
import { Cohort } from '../../../resources/js/models/Cohort.js'

// Mock apiInteractions module
vi.mock('../../../resources/js/apiInteractions.js', () => ({
  submitJobToAPI: vi.fn(),
  getJobStatus: vi.fn(),
  getCohortStatus: vi.fn(),
  createCohort: vi.fn(),
  pollJobStatusAPI: vi.fn(),
  pollCohortStatusAPI: vi.fn()
}))

// Import mocked functions
import {
  submitJobToAPI,
  getJobStatus,
  getCohortStatus,
  createCohort,
  pollJobStatusAPI,
  pollCohortStatusAPI
} from '../../../resources/js/apiInteractions.js'

describe('APIService', () => {
  let apiService
  let mockConfig
  let mockLogger

  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      API_URL: 'http://localhost:8000/api'
    }

    // Setup mock logger
    mockLogger = {
      logMessage: vi.fn()
    }

    // Create APIService instance
    apiService = new APIService({
      config: mockConfig,
      logger: mockLogger
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with provided config', () => {
      const service = new APIService({ config: mockConfig })

      expect(service.config).toBe(mockConfig)
      expect(service.baseURL).toBe('http://localhost:8000/api')
    })

    it('should use window.CONFIG as fallback', () => {
      window.CONFIG = { API_URL: 'http://fallback.com/api' }
      const service = new APIService()

      expect(service.config).toBe(window.CONFIG)
      expect(service.baseURL).toBe('http://fallback.com/api')
    })

    it('should use console as default logger', () => {
      const service = new APIService({ config: mockConfig })

      expect(service.logger).toBe(console)
    })

    it('should use provided logger', () => {
      const service = new APIService({
        config: mockConfig,
        logger: mockLogger
      })

      expect(service.logger).toBe(mockLogger)
    })
  })

  // ============================================================================
  // submitJob()
  // ============================================================================

  describe('submitJob()', () => {
    it('should submit job and return Job model', async () => {
      // Arrange
      const mockFormData = new FormData()
      const mockAPIResponse = {
        job_id: 'test-job-123',
        status: 'pending',
        file_name: 'test.bam'
      }
      submitJobToAPI.mockResolvedValue(mockAPIResponse)

      // Mock Job.fromAPI
      const mockJob = { jobId: 'test-job-123', status: 'pending' }
      vi.spyOn(Job, 'fromAPI').mockReturnValue(mockJob)

      // Act
      const result = await apiService.submitJob(mockFormData)

      // Assert
      expect(submitJobToAPI).toHaveBeenCalledWith(mockFormData, null, null)
      expect(Job.fromAPI).toHaveBeenCalledWith(mockAPIResponse)
      expect(result).toBe(mockJob)
    })

    it('should submit job with cohort ID and passphrase', async () => {
      // Arrange
      const mockFormData = new FormData()
      const cohortId = 'cohort-123'
      const passphrase = 'secret'
      const mockAPIResponse = {
        job_id: 'test-job-123',
        status: 'pending'
      }
      submitJobToAPI.mockResolvedValue(mockAPIResponse)
      vi.spyOn(Job, 'fromAPI').mockReturnValue({})

      // Act
      await apiService.submitJob(mockFormData, cohortId, passphrase)

      // Assert
      expect(submitJobToAPI).toHaveBeenCalledWith(mockFormData, cohortId, passphrase)
    })

    it('should handle errors and log them', async () => {
      // Arrange
      const mockFormData = new FormData()
      const error = new Error('Network error')
      submitJobToAPI.mockRejectedValue(error)

      // Act & Assert
      await expect(apiService.submitJob(mockFormData)).rejects.toThrow('Network error')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.submitJob] Network error',
        'error'
      )
    })
  })

  // ============================================================================
  // getJobStatus()
  // ============================================================================

  describe('getJobStatus()', () => {
    it('should get job status', async () => {
      // Arrange
      const jobId = 'test-job-123'
      const mockStatus = {
        job_id: jobId,
        status: 'completed',
        result_url: '/download/test-job-123'
      }
      getJobStatus.mockResolvedValue(mockStatus)

      // Act
      const result = await apiService.getJobStatus(jobId)

      // Assert
      expect(getJobStatus).toHaveBeenCalledWith(jobId)
      expect(result).toEqual(mockStatus)
    })

    it('should handle errors and log them', async () => {
      // Arrange
      const jobId = 'test-job-123'
      const error = new Error('Job not found')
      getJobStatus.mockRejectedValue(error)

      // Act & Assert
      await expect(apiService.getJobStatus(jobId)).rejects.toThrow('Job not found')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.getJobStatus] Job not found',
        'error'
      )
    })
  })

  // ============================================================================
  // pollJobStatus()
  // ============================================================================

  describe('pollJobStatus()', () => {
    it('should start polling job status', () => {
      // Arrange
      const jobId = 'test-job-123'
      const onUpdate = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()
      const mockStopFn = vi.fn()
      pollJobStatusAPI.mockReturnValue(mockStopFn)

      // Act
      const result = apiService.pollJobStatus(jobId, onUpdate, onComplete, onError)

      // Assert
      expect(pollJobStatusAPI).toHaveBeenCalledWith(jobId, onUpdate, onComplete, onError)
      expect(result).toBe(mockStopFn)
    })

    it('should handle errors during polling setup', () => {
      // Arrange
      const jobId = 'test-job-123'
      const error = new Error('Polling setup failed')
      pollJobStatusAPI.mockImplementation(() => {
        throw error
      })

      // Act & Assert
      expect(() => {
        apiService.pollJobStatus(jobId, vi.fn(), vi.fn(), vi.fn())
      }).toThrow('Polling setup failed')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.pollJobStatus] Polling setup failed',
        'error'
      )
    })
  })

  // ============================================================================
  // createCohort()
  // ============================================================================

  describe('createCohort()', () => {
    it('should create cohort and return Cohort model', async () => {
      // Arrange
      const alias = 'Test Cohort'
      const mockAPIResponse = {
        cohort_id: 'cohort-abc-123',
        alias: 'Test Cohort',
        has_passphrase: false
      }
      createCohort.mockResolvedValue(mockAPIResponse)

      // Mock Cohort.fromAPI
      const mockCohort = { cohortId: 'cohort-abc-123', alias: 'Test Cohort' }
      vi.spyOn(Cohort, 'fromAPI').mockReturnValue(mockCohort)

      // Act
      const result = await apiService.createCohort(alias)

      // Assert
      expect(createCohort).toHaveBeenCalledWith(alias, null)
      expect(Cohort.fromAPI).toHaveBeenCalledWith(mockAPIResponse)
      expect(result).toBe(mockCohort)
    })

    it('should create cohort with passphrase', async () => {
      // Arrange
      const alias = 'Protected Cohort'
      const passphrase = 'secret123'
      const mockAPIResponse = {
        cohort_id: 'cohort-abc-123',
        alias: 'Protected Cohort',
        has_passphrase: true
      }
      createCohort.mockResolvedValue(mockAPIResponse)
      vi.spyOn(Cohort, 'fromAPI').mockReturnValue({})

      // Act
      await apiService.createCohort(alias, passphrase)

      // Assert
      expect(createCohort).toHaveBeenCalledWith(alias, passphrase)
    })

    it('should handle errors and log them', async () => {
      // Arrange
      const alias = 'Test Cohort'
      const error = new Error('Cohort creation failed')
      createCohort.mockRejectedValue(error)

      // Act & Assert
      await expect(apiService.createCohort(alias)).rejects.toThrow('Cohort creation failed')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.createCohort] Cohort creation failed',
        'error'
      )
    })
  })

  // ============================================================================
  // getCohortStatus()
  // ============================================================================

  describe('getCohortStatus()', () => {
    it('should get cohort status', async () => {
      // Arrange
      const cohortId = 'cohort-abc-123'
      const mockStatus = {
        cohort_id: cohortId,
        status: 'completed',
        job_count: 5
      }
      getCohortStatus.mockResolvedValue(mockStatus)

      // Act
      const result = await apiService.getCohortStatus(cohortId)

      // Assert
      expect(getCohortStatus).toHaveBeenCalledWith(cohortId, null, null)
      expect(result).toEqual(mockStatus)
    })

    it('should get cohort status with passphrase and alias', async () => {
      // Arrange
      const cohortId = 'cohort-abc-123'
      const passphrase = 'secret'
      const alias = 'Test Cohort'
      const mockStatus = { cohort_id: cohortId }
      getCohortStatus.mockResolvedValue(mockStatus)

      // Act
      await apiService.getCohortStatus(cohortId, passphrase, alias)

      // Assert
      expect(getCohortStatus).toHaveBeenCalledWith(cohortId, passphrase, alias)
    })

    it('should handle errors and log them', async () => {
      // Arrange
      const cohortId = 'cohort-abc-123'
      const error = new Error('Cohort not found')
      getCohortStatus.mockRejectedValue(error)

      // Act & Assert
      await expect(apiService.getCohortStatus(cohortId)).rejects.toThrow('Cohort not found')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.getCohortStatus] Cohort not found',
        'error'
      )
    })
  })

  // ============================================================================
  // pollCohortStatus()
  // ============================================================================

  describe('pollCohortStatus()', () => {
    it('should start polling cohort status', () => {
      // Arrange
      const cohortId = 'cohort-abc-123'
      const passphrase = 'secret'
      const onUpdate = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()
      const mockStopFn = vi.fn()
      pollCohortStatusAPI.mockReturnValue(mockStopFn)

      // Act
      const result = apiService.pollCohortStatus(
        cohortId,
        passphrase,
        onUpdate,
        onComplete,
        onError
      )

      // Assert
      expect(pollCohortStatusAPI).toHaveBeenCalledWith(
        cohortId,
        passphrase,
        onUpdate,
        onComplete,
        onError
      )
      expect(result).toBe(mockStopFn)
    })

    it('should handle errors during polling setup', () => {
      // Arrange
      const cohortId = 'cohort-abc-123'
      const error = new Error('Cohort polling setup failed')
      pollCohortStatusAPI.mockImplementation(() => {
        throw error
      })

      // Act & Assert
      expect(() => {
        apiService.pollCohortStatus(cohortId, null, vi.fn(), vi.fn(), vi.fn())
      }).toThrow('Cohort polling setup failed')

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.pollCohortStatus] Cohort polling setup failed',
        'error'
      )
    })
  })

  // ============================================================================
  // _handleError() - Private method
  // ============================================================================

  describe('_handleError()', () => {
    it('should log error with logger.logMessage if available', () => {
      // Arrange
      const error = new Error('Test error')

      // Act
      apiService._handleError('testMethod', error)

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[APIService.testMethod] Test error',
        'error'
      )
    })

    it('should use console.error if logger.logMessage is not available', () => {
      // Arrange
      const service = new APIService({
        config: mockConfig,
        logger: { error: vi.fn() } // Logger without logMessage method
      })
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Test error')

      // Act
      service._handleError('testMethod', error)

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '[APIService.testMethod] Test error',
        error
      )
    })
  })
})
