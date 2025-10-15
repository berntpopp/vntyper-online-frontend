// tests/unit/controllers/FileController.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileController } from '../../../resources/js/controllers/FileController.js'

// Mock inputWrangling module
vi.mock('../../../resources/js/inputWrangling.js', () => ({
  validateFiles: vi.fn()
}))

// Import mocked function
import { validateFiles } from '../../../resources/js/inputWrangling.js'

describe('FileController', () => {
  let fileController
  let mockEventBus
  let mockLogger
  let mockErrorView
  let mockSelectedFiles

  beforeEach(() => {
    // Setup mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn(),
      emitAsync: vi.fn()
    }

    // Setup mock logger
    mockLogger = {
      logMessage: vi.fn()
    }

    // Setup mock ErrorView
    mockErrorView = {
      show: vi.fn(),
      showValidation: vi.fn(),
      hide: vi.fn(),
      clear: vi.fn()
    }

    // Setup mock StateManager (required by BaseController)
    const mockStateManager = {
      getState: vi.fn(),
      setState: vi.fn()
    }

    // Setup mock selected files array (shared reference)
    mockSelectedFiles = []

    // Create FileController instance
    fileController = new FileController({
      eventBus: mockEventBus,
      logger: mockLogger,
      stateManager: mockStateManager,
      errorView: mockErrorView,
      selectedFiles: mockSelectedFiles
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
    it('should initialize with provided dependencies', () => {
      expect(fileController.eventBus).toBe(mockEventBus)
      expect(fileController.logger).toBe(mockLogger)
      expect(fileController.errorView).toBe(mockErrorView)
      expect(fileController.selectedFiles).toBe(mockSelectedFiles)
    })

    it('should initialize with empty selectedFiles if not provided', () => {
      const controller = new FileController({
        eventBus: mockEventBus,
        logger: mockLogger,
        errorView: mockErrorView,
        stateManager: { getState: vi.fn(), setState: vi.fn() }
      })

      expect(controller.selectedFiles).toEqual([])
    })

    it('should extend BaseController', () => {
      expect(fileController.on).toBeDefined()
      expect(fileController.emit).toBeDefined()
      expect(fileController.handleError).toBeDefined()
    })
  })

  // ============================================================================
  // bindEvents()
  // ============================================================================

  describe('bindEvents()', () => {
    it('should bind all file-related events', () => {
      // Act
      fileController.bindEvents()

      // Assert - EventBus.on() is called with (eventName, handler, options)
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'files:selected',
        expect.any(Function),
        {}
      )
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'files:validate',
        expect.any(Function),
        {}
      )
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'files:clear',
        expect.any(Function),
        {}
      )
      expect(mockEventBus.on).toHaveBeenCalledTimes(3)
    })
  })

  // ============================================================================
  // handleFilesSelected() - Successful selection
  // ============================================================================

  describe('handleFilesSelected() - Successful selection', () => {
    it('should handle file selection and emit validation event', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test1.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test1.bam.bai', { type: 'application/octet-stream' })
      ]
      fileController.selectedFiles.push(...mockFiles)

      // Act
      fileController.handleFilesSelected({ files: mockFiles })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:validate',
        { files: fileController.selectedFiles }
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:selected:success',
        { files: fileController.selectedFiles }
      )
    })

    it('should log file selection info', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      ]
      fileController.selectedFiles.push(...mockFiles)

      // Act
      fileController.handleFilesSelected({ files: mockFiles })

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Files selected: 1',
        'info'
      )
    })

    it('should handle empty file selection', () => {
      // Arrange
      const mockFiles = []

      // Act
      fileController.handleFilesSelected({ files: mockFiles })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:validate',
        { files: [] }
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:selected:success',
        { files: [] }
      )
    })

    it('should handle multiple file selection', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test1.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test1.bam.bai', { type: 'application/octet-stream' }),
        new File(['content'], 'test2.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test2.bam.bai', { type: 'application/octet-stream' })
      ]
      fileController.selectedFiles.push(...mockFiles)

      // Act
      fileController.handleFilesSelected({ files: mockFiles })

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Files selected: 4',
        'info'
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:selected:success',
        { files: expect.arrayContaining(mockFiles) }
      )
    })
  })

  // ============================================================================
  // handleFilesSelected() - Error handling
  // ============================================================================

  describe('handleFilesSelected() - Error handling', () => {
    it('should handle errors during file selection', () => {
      // Arrange - make _log throw to trigger error handling
      const error = new Error('File selection error')
      vi.spyOn(fileController, '_log').mockImplementation(() => {
        throw error
      })

      // Act
      fileController.handleFilesSelected({ files: [] })

      // Assert
      expect(mockErrorView.show).toHaveBeenCalledWith(error, 'File Selection')
    })

    it('should log errors during file selection', () => {
      // Arrange - make _log throw to trigger error handling
      const error = new Error('Selection failed')
      vi.spyOn(fileController, '_log').mockImplementation(() => {
        throw error
      })

      // Act
      fileController.handleFilesSelected({ files: [] })

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('[FileController] File selection failed'),
        'error'
      )
    })
  })

  // ============================================================================
  // handleValidation() - Successful validation
  // ============================================================================

  describe('handleValidation() - Successful validation', () => {
    it('should validate files and emit validation result', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test.bam.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [{ bam: mockFiles[0], bai: mockFiles[1] }],
        invalidFiles: []
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      const result = fileController.handleValidation({ files: mockFiles })

      // Assert
      expect(validateFiles).toHaveBeenCalledWith(mockFiles, false)
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: mockValidationResult.matchedPairs,
        invalidFiles: [],
        isValid: true
      })
      expect(result).toEqual(mockValidationResult)
    })

    it('should show validation errors when invalid files exist', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'orphan.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [],
        invalidFiles: [mockFiles[1]]
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      fileController.handleValidation({ files: mockFiles, showErrors: true })

      // Assert
      expect(mockErrorView.showValidation).toHaveBeenCalledWith(
        'Invalid files: orphan.bai'
      )
    })

    it('should not show validation errors when showErrors is false', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'orphan.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [],
        invalidFiles: [mockFiles[0]]
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      fileController.handleValidation({ files: mockFiles, showErrors: false })

      // Assert
      expect(mockErrorView.showValidation).not.toHaveBeenCalled()
    })

    it('should handle validation with mixed valid and invalid files', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'valid.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'valid.bam.bai', { type: 'application/octet-stream' }),
        new File(['content'], 'orphan.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [{ bam: mockFiles[0], bai: mockFiles[1] }],
        invalidFiles: [mockFiles[2]]
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      const result = fileController.handleValidation({ files: mockFiles })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: [{ bam: mockFiles[0], bai: mockFiles[1] }],
        invalidFiles: [mockFiles[2]],
        isValid: true // Still valid because we have at least one matched pair
      })
      expect(result.matchedPairs.length).toBe(1)
      expect(result.invalidFiles.length).toBe(1)
    })

    it('should return isValid false when no matched pairs', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'orphan.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [],
        invalidFiles: [mockFiles[0]]
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      fileController.handleValidation({ files: mockFiles, showErrors: false })

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: [],
        invalidFiles: [mockFiles[0]],
        isValid: false
      })
    })

    it('should log validation progress', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      ]
      validateFiles.mockReturnValue({ matchedPairs: [], invalidFiles: [] })

      // Act
      fileController.handleValidation({ files: mockFiles })

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Validating 1 files',
        'info'
      )
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Validation result: 0 pairs, 0 invalid',
        'info'
      )
    })

    it('should handle SAM file validation', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.sam', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [{ sam: mockFiles[0] }],
        invalidFiles: []
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      const result = fileController.handleValidation({ files: mockFiles })

      // Assert
      expect(result.matchedPairs).toEqual([{ sam: mockFiles[0] }])
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: [{ sam: mockFiles[0] }],
        invalidFiles: [],
        isValid: true
      })
    })

    it('should handle multiple BAM/BAI pairs', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test1.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test1.bam.bai', { type: 'application/octet-stream' }),
        new File(['content'], 'test2.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test2.bam.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [
          { bam: mockFiles[0], bai: mockFiles[1] },
          { bam: mockFiles[2], bai: mockFiles[3] }
        ],
        invalidFiles: []
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act
      const result = fileController.handleValidation({ files: mockFiles })

      // Assert
      expect(result.matchedPairs.length).toBe(2)
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Validation result: 2 pairs, 0 invalid',
        'info'
      )
    })
  })

  // ============================================================================
  // handleValidation() - Error handling
  // ============================================================================

  describe('handleValidation() - Error handling', () => {
    it('should handle validation errors', () => {
      // Arrange
      const error = new Error('Validation failed')
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      ]
      validateFiles.mockImplementation(() => {
        throw error
      })

      // Act & Assert
      expect(() => {
        fileController.handleValidation({ files: mockFiles })
      }).toThrow('Validation failed')

      expect(mockErrorView.show).toHaveBeenCalledWith(error, 'File Validation')
    })

    it('should log validation errors', () => {
      // Arrange
      const error = new Error('Validation error')
      validateFiles.mockImplementation(() => {
        throw error
      })

      // Act & Assert
      expect(() => {
        fileController.handleValidation({ files: [] })
      }).toThrow()

      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        expect.stringContaining('[FileController] File validation failed'),
        'error'
      )
    })
  })

  // ============================================================================
  // handleClear()
  // ============================================================================

  describe('handleClear()', () => {
    it('should clear selected files array', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )
      expect(fileController.selectedFiles.length).toBe(1)

      // Act
      fileController.handleClear()

      // Assert
      expect(fileController.selectedFiles.length).toBe(0)
    })

    it('should emit files:cleared event', () => {
      // Act
      fileController.handleClear()

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:cleared')
    })

    it('should log clear action', () => {
      // Act
      fileController.handleClear()

      // Assert
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        '[FileController] Clearing file selection',
        'info'
      )
    })

    it('should handle clearing already empty files', () => {
      // Arrange
      expect(fileController.selectedFiles.length).toBe(0)

      // Act
      fileController.handleClear()

      // Assert
      expect(fileController.selectedFiles.length).toBe(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:cleared')
    })

    it('should clear shared reference without replacing array', () => {
      // Arrange
      const originalArray = fileController.selectedFiles
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )

      // Act
      fileController.handleClear()

      // Assert
      expect(fileController.selectedFiles).toBe(originalArray) // Same reference
      expect(fileController.selectedFiles.length).toBe(0)
    })
  })

  // ============================================================================
  // getSelectedFiles()
  // ============================================================================

  describe('getSelectedFiles()', () => {
    it('should return selected files array', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      ]
      fileController.selectedFiles.push(...mockFiles)

      // Act
      const result = fileController.getSelectedFiles()

      // Assert
      expect(result).toBe(fileController.selectedFiles)
      expect(result).toEqual(mockFiles)
    })

    it('should return empty array when no files selected', () => {
      // Act
      const result = fileController.getSelectedFiles()

      // Assert
      expect(result).toEqual([])
    })

    it('should return live reference to array', () => {
      // Arrange
      const result = fileController.getSelectedFiles()

      // Act
      result.push(new File(['content'], 'test.bam', { type: 'application/octet-stream' }))

      // Assert
      expect(fileController.selectedFiles.length).toBe(1)
    })
  })

  // ============================================================================
  // getFileCount()
  // ============================================================================

  describe('getFileCount()', () => {
    it('should return 0 when no files selected', () => {
      // Act
      const count = fileController.getFileCount()

      // Assert
      expect(count).toBe(0)
    })

    it('should return correct count for single file', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )

      // Act
      const count = fileController.getFileCount()

      // Assert
      expect(count).toBe(1)
    })

    it('should return correct count for multiple files', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test1.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test1.bam.bai', { type: 'application/octet-stream' }),
        new File(['content'], 'test2.bam', { type: 'application/octet-stream' })
      )

      // Act
      const count = fileController.getFileCount()

      // Assert
      expect(count).toBe(3)
    })

    it('should update count after adding files', () => {
      // Arrange
      expect(fileController.getFileCount()).toBe(0)

      // Act
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )

      // Assert
      expect(fileController.getFileCount()).toBe(1)
    })

    it('should update count after clearing files', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )
      expect(fileController.getFileCount()).toBe(1)

      // Act
      fileController.handleClear()

      // Assert
      expect(fileController.getFileCount()).toBe(0)
    })
  })

  // ============================================================================
  // hasFiles()
  // ============================================================================

  describe('hasFiles()', () => {
    it('should return false when no files selected', () => {
      // Act
      const result = fileController.hasFiles()

      // Assert
      expect(result).toBe(false)
    })

    it('should return true when files are selected', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )

      // Act
      const result = fileController.hasFiles()

      // Assert
      expect(result).toBe(true)
    })

    it('should return false after clearing files', () => {
      // Arrange
      fileController.selectedFiles.push(
        new File(['content'], 'test.bam', { type: 'application/octet-stream' })
      )
      expect(fileController.hasFiles()).toBe(true)

      // Act
      fileController.handleClear()

      // Assert
      expect(fileController.hasFiles()).toBe(false)
    })
  })

  // ============================================================================
  // Integration Workflow
  // ============================================================================

  describe('Integration Workflow', () => {
    it('should handle complete file selection and validation workflow', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'patient1.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'patient1.bam.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [{ bam: mockFiles[0], bai: mockFiles[1] }],
        invalidFiles: []
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act - Step 1: Select files
      fileController.selectedFiles.push(...mockFiles)
      fileController.handleFilesSelected({ files: mockFiles })

      // Assert - Step 1
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'files:validate',
        { files: mockFiles }
      )

      // Act - Step 2: Validation triggered
      const validationResult = fileController.handleValidation({
        files: mockFiles,
        showErrors: true
      })

      // Assert - Step 2
      expect(validationResult.matchedPairs.length).toBe(1)
      expect(validationResult.invalidFiles.length).toBe(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: expect.any(Array),
        invalidFiles: [],
        isValid: true
      })

      // Assert - Final state
      expect(fileController.hasFiles()).toBe(true)
      expect(fileController.getFileCount()).toBe(2)
    })

    it('should handle file selection with validation errors', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'orphan.bai', { type: 'application/octet-stream' })
      ]
      const mockValidationResult = {
        matchedPairs: [],
        invalidFiles: [mockFiles[0], mockFiles[1]]
      }
      validateFiles.mockReturnValue(mockValidationResult)

      // Act - Select and validate
      fileController.selectedFiles.push(...mockFiles)
      fileController.handleFilesSelected({ files: mockFiles })
      const result = fileController.handleValidation({
        files: mockFiles,
        showErrors: true
      })

      // Assert - Validation should fail
      expect(result.matchedPairs.length).toBe(0)
      expect(result.invalidFiles.length).toBe(2)
      expect(mockErrorView.showValidation).toHaveBeenCalledWith(
        expect.stringContaining('Invalid files')
      )
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:validated', {
        matchedPairs: [],
        invalidFiles: [mockFiles[0], mockFiles[1]],
        isValid: false
      })
    })

    it('should handle file selection, validation, and clearing workflow', () => {
      // Arrange
      const mockFiles = [
        new File(['content'], 'test.bam', { type: 'application/octet-stream' }),
        new File(['content'], 'test.bam.bai', { type: 'application/octet-stream' })
      ]
      validateFiles.mockReturnValue({
        matchedPairs: [{ bam: mockFiles[0], bai: mockFiles[1] }],
        invalidFiles: []
      })

      // Act - Step 1: Select and validate
      fileController.selectedFiles.push(...mockFiles)
      fileController.handleFilesSelected({ files: mockFiles })
      fileController.handleValidation({ files: mockFiles })

      expect(fileController.hasFiles()).toBe(true)

      // Act - Step 2: Clear files
      fileController.handleClear()

      // Assert - Final state
      expect(fileController.hasFiles()).toBe(false)
      expect(fileController.getFileCount()).toBe(0)
      expect(mockEventBus.emit).toHaveBeenCalledWith('files:cleared')
    })
  })
})
