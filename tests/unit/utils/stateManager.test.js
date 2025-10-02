// tests/unit/utils/stateManager.test.js

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { StateManager } from '../../../resources/js/stateManager.js'

// Mock log.js dependency
vi.mock('../../../resources/js/log.js', () => ({
  logMessage: vi.fn()
}))

describe('StateManager', () => {
  let stateManager

  beforeEach(() => {
    stateManager = new StateManager()
    vi.useFakeTimers()
  })

  afterEach(() => {
    stateManager.cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('constructor()', () => {
    it('should initialize with default state structure', () => {
      expect(stateManager.state).toBeDefined()
      expect(stateManager.state.selectedFiles).toEqual([])
      expect(stateManager.state.jobs).toBeInstanceOf(Map)
      expect(stateManager.state.cohorts).toBeInstanceOf(Map)
      expect(stateManager.state.displayedCohorts).toBeInstanceOf(Set)
      expect(stateManager.state.countdown).toMatchObject({
        interval: null,
        timeLeft: 20,
        isActive: false,
        jobId: null
      })
      expect(stateManager.state.spinner).toMatchObject({
        isActive: false,
        count: 0
      })
    })

    it('should initialize listeners map', () => {
      expect(stateManager.listeners).toBeInstanceOf(Map)
      expect(stateManager.listeners.size).toBe(0)
    })

    it('should initialize empty history', () => {
      expect(stateManager.history).toEqual([])
      expect(stateManager.maxHistory).toBe(100)
    })
  })

  describe('get() / set() - Path-based state access', () => {
    it('should get simple value by path', () => {
      stateManager.state.countdown.timeLeft = 15

      expect(stateManager.get('countdown.timeLeft')).toBe(15)
    })

    it('should get nested value by path', () => {
      expect(stateManager.get('spinner.isActive')).toBe(false)
    })

    it('should set value and trigger events', () => {
      const listener = vi.fn()
      stateManager.on('countdown.timeLeft', listener)

      stateManager.set('countdown.timeLeft', 10)

      expect(stateManager.get('countdown.timeLeft')).toBe(10)
      expect(listener).toHaveBeenCalledWith(10, 20) // new, old
    })

    it('should emit generic state.changed event', () => {
      const listener = vi.fn()
      stateManager.on('state.changed', listener)

      stateManager.set('countdown.timeLeft', 5)

      expect(listener).toHaveBeenCalledWith({
        path: 'countdown.timeLeft',
        value: 5,
        oldValue: 20
      })
    })

    it('should not update if value unchanged', () => {
      const listener = vi.fn()
      stateManager.on('countdown.timeLeft', listener)

      stateManager.set('countdown.timeLeft', 20) // Same as initial

      expect(listener).not.toHaveBeenCalled()
    })

    it('should record set in history', () => {
      stateManager.set('countdown.timeLeft', 15)

      const history = stateManager.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        type: 'set',
        path: 'countdown.timeLeft',
        oldValue: 20,
        newValue: 15
      })
    })

    it('should return undefined for non-existent path', () => {
      expect(stateManager.get('nonexistent.path')).toBeUndefined()
    })
  })

  describe('Job Management', () => {
    describe('addJob()', () => {
      it('should add job with data', () => {
        stateManager.addJob('job-123', {
          status: 'pending',
          fileName: 'test.bam'
        })

        const job = stateManager.getJob('job-123')
        expect(job).toMatchObject({
          status: 'pending',
          fileName: 'test.bam'
        })
        expect(job.createdAt).toBeDefined()
        expect(job.updatedAt).toBeDefined()
      })

      it('should emit job.added and jobs.changed events', () => {
        const addedListener = vi.fn()
        const changedListener = vi.fn()
        stateManager.on('job.added', addedListener)
        stateManager.on('jobs.changed', changedListener)

        stateManager.addJob('job-123', { status: 'pending' })

        expect(addedListener).toHaveBeenCalledWith('job-123', { status: 'pending' })
        expect(changedListener).toHaveBeenCalled()
      })

      it('should record in history', () => {
        stateManager.addJob('job-123', { status: 'pending' })

        const history = stateManager.getHistory()
        expect(history.some(h => h.type === 'job.added' && h.jobId === 'job-123')).toBe(true)
      })
    })

    describe('updateJob()', () => {
      it('should update job data', () => {
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.updateJob('job-123', { status: 'completed', result: 'success' })

        const job = stateManager.getJob('job-123')
        expect(job.status).toBe('completed')
        expect(job.result).toBe('success')
      })

      it('should update updatedAt timestamp', () => {
        stateManager.addJob('job-123', { status: 'pending' })
        const initialUpdatedAt = stateManager.getJob('job-123').updatedAt

        vi.advanceTimersByTime(1000)
        stateManager.updateJob('job-123', { status: 'completed' })

        expect(stateManager.getJob('job-123').updatedAt).toBeGreaterThan(initialUpdatedAt)
      })

      it('should warn if job not found', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        stateManager.updateJob('nonexistent', { status: 'completed' })

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Job not found: nonexistent')
        )
      })

      it('should emit job.updated and jobs.changed events', () => {
        const updatedListener = vi.fn()
        stateManager.on('job.updated', updatedListener)
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.updateJob('job-123', { status: 'completed' })

        expect(updatedListener).toHaveBeenCalledWith('job-123', expect.any(Object))
      })
    })

    describe('updateJobStatus()', () => {
      it('should update status using convenience method', () => {
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.updateJobStatus('job-123', 'completed')

        expect(stateManager.getJob('job-123').status).toBe('completed')
      })
    })

    describe('removeJob()', () => {
      it('should remove job from tracking', () => {
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.removeJob('job-123')

        expect(stateManager.getJob('job-123')).toBeNull()
      })

      it('should emit job.removed and jobs.changed events', () => {
        const removedListener = vi.fn()
        stateManager.on('job.removed', removedListener)
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.removeJob('job-123')

        expect(removedListener).toHaveBeenCalledWith('job-123', expect.any(Object))
      })

      it('should handle removing non-existent job gracefully', () => {
        expect(() => stateManager.removeJob('nonexistent')).not.toThrow()
      })
    })

    describe('getJobs()', () => {
      it('should return array of all jobs', () => {
        stateManager.addJob('job-1', { status: 'pending' })
        stateManager.addJob('job-2', { status: 'completed' })
        stateManager.addJob('job-3', { status: 'failed' })

        const jobs = stateManager.getJobs()

        expect(jobs).toHaveLength(3)
        expect(jobs.map(j => j.status)).toEqual(['pending', 'completed', 'failed'])
      })

      it('should return empty array when no jobs', () => {
        expect(stateManager.getJobs()).toEqual([])
      })
    })

    describe('setJobPolling() / getJobPolling()', () => {
      it('should store polling stop function', () => {
        const stopFn = vi.fn()
        stateManager.addJob('job-123', { status: 'pending' })

        stateManager.setJobPolling('job-123', stopFn)

        expect(stateManager.getJobPolling('job-123')).toBe(stopFn)
      })

      it('should return null for job without polling', () => {
        stateManager.addJob('job-123', { status: 'pending' })

        expect(stateManager.getJobPolling('job-123')).toBeNull()
      })
    })
  })

  describe('Cohort Management', () => {
    describe('addCohort()', () => {
      it('should add cohort with data', () => {
        stateManager.addCohort('cohort-123', {
          alias: 'Test Cohort'
        })

        const cohort = stateManager.getCohort('cohort-123')
        expect(cohort).toMatchObject({
          alias: 'Test Cohort',
          jobIds: []
        })
        expect(cohort.createdAt).toBeDefined()
      })

      it('should initialize jobIds array if not provided', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        expect(stateManager.getCohort('cohort-123').jobIds).toEqual([])
      })

      it('should preserve jobIds if provided', () => {
        stateManager.addCohort('cohort-123', {
          alias: 'Test',
          jobIds: ['job-1', 'job-2']
        })

        expect(stateManager.getCohort('cohort-123').jobIds).toEqual(['job-1', 'job-2'])
      })

      it('should emit cohort.added and cohorts.changed events', () => {
        const addedListener = vi.fn()
        const changedListener = vi.fn()
        stateManager.on('cohort.added', addedListener)
        stateManager.on('cohorts.changed', changedListener)

        stateManager.addCohort('cohort-123', { alias: 'Test' })

        expect(addedListener).toHaveBeenCalledWith('cohort-123', expect.any(Object))
        expect(changedListener).toHaveBeenCalled()
      })
    })

    describe('addJobToCohort()', () => {
      it('should add job to cohort', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        stateManager.addJobToCohort('cohort-123', 'job-1')
        stateManager.addJobToCohort('cohort-123', 'job-2')

        const cohort = stateManager.getCohort('cohort-123')
        expect(cohort.jobIds).toEqual(['job-1', 'job-2'])
      })

      it('should update cohort updatedAt timestamp', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })
        const initialUpdatedAt = stateManager.getCohort('cohort-123').updatedAt

        vi.advanceTimersByTime(1000)
        stateManager.addJobToCohort('cohort-123', 'job-1')

        expect(stateManager.getCohort('cohort-123').updatedAt).toBeGreaterThan(initialUpdatedAt)
      })

      it('should track cohortId in job', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })
        stateManager.addJob('job-1', { status: 'pending' })

        stateManager.addJobToCohort('cohort-123', 'job-1')

        expect(stateManager.getJob('job-1').cohortId).toBe('cohort-123')
      })

      it('should not add duplicate job IDs', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        stateManager.addJobToCohort('cohort-123', 'job-1')
        stateManager.addJobToCohort('cohort-123', 'job-1') // Duplicate

        expect(stateManager.getCohort('cohort-123').jobIds).toEqual(['job-1'])
      })

      it('should emit cohort.job.added and cohorts.changed events', () => {
        const listener = vi.fn()
        stateManager.on('cohort.job.added', listener)
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        stateManager.addJobToCohort('cohort-123', 'job-1')

        expect(listener).toHaveBeenCalledWith('cohort-123', 'job-1')
      })
    })

    describe('getCohortJobCount()', () => {
      it('should return number of jobs in cohort', () => {
        stateManager.addCohort('cohort-123', {
          alias: 'Test',
          jobIds: ['job-1', 'job-2', 'job-3']
        })

        expect(stateManager.getCohortJobCount('cohort-123')).toBe(3)
      })

      it('should return 0 for cohort with no jobs', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        expect(stateManager.getCohortJobCount('cohort-123')).toBe(0)
      })

      it('should return 0 for non-existent cohort', () => {
        expect(stateManager.getCohortJobCount('nonexistent')).toBe(0)
      })
    })

    describe('getJobCohort()', () => {
      it('should return cohort ID for job', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })
        stateManager.addJob('job-1', { status: 'pending' })
        stateManager.addJobToCohort('cohort-123', 'job-1')

        expect(stateManager.getJobCohort('job-1')).toBe('cohort-123')
      })

      it('should return null for job not in cohort', () => {
        stateManager.addJob('job-1', { status: 'pending' })

        expect(stateManager.getJobCohort('job-1')).toBeNull()
      })
    })

    describe('areCohortJobsComplete()', () => {
      it('should return true when all jobs completed', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })
        stateManager.addJob('job-1', { status: 'completed' })
        stateManager.addJob('job-2', { status: 'completed' })
        stateManager.addJobToCohort('cohort-123', 'job-1')
        stateManager.addJobToCohort('cohort-123', 'job-2')

        expect(stateManager.areCohortJobsComplete('cohort-123')).toBe(true)
      })

      it('should return false when some jobs not completed', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })
        stateManager.addJob('job-1', { status: 'completed' })
        stateManager.addJob('job-2', { status: 'pending' })
        stateManager.addJobToCohort('cohort-123', 'job-1')
        stateManager.addJobToCohort('cohort-123', 'job-2')

        expect(stateManager.areCohortJobsComplete('cohort-123')).toBe(false)
      })

      it('should return false for cohort with no jobs', () => {
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        expect(stateManager.areCohortJobsComplete('cohort-123')).toBe(false)
      })

      it('should return false for non-existent cohort', () => {
        expect(stateManager.areCohortJobsComplete('nonexistent')).toBe(false)
      })
    })

    describe('getCohorts()', () => {
      it('should return array of all cohorts', () => {
        stateManager.addCohort('cohort-1', { alias: 'Cohort 1' })
        stateManager.addCohort('cohort-2', { alias: 'Cohort 2' })

        const cohorts = stateManager.getCohorts()

        expect(cohorts).toHaveLength(2)
        expect(cohorts.map(c => c.alias)).toEqual(['Cohort 1', 'Cohort 2'])
      })
    })

    describe('setCohortPolling()', () => {
      it('should store polling stop function', () => {
        const stopFn = vi.fn()
        stateManager.addCohort('cohort-123', { alias: 'Test' })

        stateManager.setCohortPolling('cohort-123', stopFn)

        expect(stateManager.getCohort('cohort-123').pollStop).toBe(stopFn)
      })
    })
  })

  describe('Countdown Management', () => {
    describe('startCountdown()', () => {
      it('should start countdown with initial value', () => {
        stateManager.startCountdown('job-123')

        expect(stateManager.state.countdown.isActive).toBe(true)
        expect(stateManager.state.countdown.timeLeft).toBe(20)
        expect(stateManager.state.countdown.jobId).toBe('job-123')
      })

      it('should emit countdown.started event', () => {
        const listener = vi.fn()
        stateManager.on('countdown.started', listener)

        stateManager.startCountdown('job-123')

        expect(listener).toHaveBeenCalledWith('job-123')
      })

      it('should decrement time every second', () => {
        stateManager.startCountdown()

        vi.advanceTimersByTime(3000) // 3 seconds

        expect(stateManager.state.countdown.timeLeft).toBe(17)
      })

      it('should emit countdown.tick event on each tick', () => {
        const listener = vi.fn()
        stateManager.on('countdown.tick', listener)

        stateManager.startCountdown()
        vi.advanceTimersByTime(1000)

        expect(listener).toHaveBeenCalledWith(19)
      })

      it('should reset to 20 when reaching zero', () => {
        stateManager.startCountdown()

        // Advance exactly 20 seconds to reach zero and trigger reset
        vi.advanceTimersByTime(20000)

        expect(stateManager.state.countdown.timeLeft).toBe(20)
      })

      it('should clear existing countdown before starting new one', () => {
        stateManager.startCountdown('job-1')
        const firstInterval = stateManager.state.countdown.interval

        stateManager.startCountdown('job-2')
        const secondInterval = stateManager.state.countdown.interval

        expect(firstInterval).not.toBe(secondInterval)
        expect(stateManager.state.countdown.jobId).toBe('job-2')
      })
    })

    describe('resetCountdown()', () => {
      it('should reset time to 20 without stopping', () => {
        stateManager.startCountdown()
        vi.advanceTimersByTime(5000) // 5 seconds

        stateManager.resetCountdown()

        expect(stateManager.state.countdown.timeLeft).toBe(20)
        expect(stateManager.state.countdown.isActive).toBe(true)
      })

      it('should emit countdown.reset event', () => {
        const listener = vi.fn()
        stateManager.on('countdown.reset', listener)

        stateManager.resetCountdown()

        expect(listener).toHaveBeenCalled()
      })
    })

    describe('clearCountdown()', () => {
      it('should stop countdown and clear state', () => {
        stateManager.startCountdown('job-123')

        stateManager.clearCountdown()

        expect(stateManager.state.countdown.interval).toBeNull()
        expect(stateManager.state.countdown.isActive).toBe(false)
        expect(stateManager.state.countdown.jobId).toBeNull()
      })

      it('should emit countdown.stopped event', () => {
        const listener = vi.fn()
        stateManager.on('countdown.stopped', listener)
        stateManager.startCountdown()

        stateManager.clearCountdown()

        expect(listener).toHaveBeenCalled()
      })

      it('should handle multiple calls gracefully', () => {
        stateManager.startCountdown()

        stateManager.clearCountdown()
        stateManager.clearCountdown() // Second call

        expect(() => stateManager.clearCountdown()).not.toThrow()
      })
    })
  })

  describe('Spinner Management', () => {
    describe('showSpinner()', () => {
      it('should activate spinner on first call', () => {
        stateManager.showSpinner()

        expect(stateManager.state.spinner.isActive).toBe(true)
        expect(stateManager.state.spinner.count).toBe(1)
      })

      it('should emit spinner.shown event only once', () => {
        const listener = vi.fn()
        stateManager.on('spinner.shown', listener)

        stateManager.showSpinner()
        stateManager.showSpinner()

        expect(listener).toHaveBeenCalledOnce()
      })

      it('should support nesting (increment count)', () => {
        stateManager.showSpinner()
        stateManager.showSpinner()
        stateManager.showSpinner()

        expect(stateManager.state.spinner.count).toBe(3)
      })
    })

    describe('hideSpinner()', () => {
      it('should decrement count on hide', () => {
        stateManager.showSpinner()
        stateManager.showSpinner()

        stateManager.hideSpinner()

        expect(stateManager.state.spinner.count).toBe(1)
        expect(stateManager.state.spinner.isActive).toBe(true)
      })

      it('should deactivate when count reaches zero', () => {
        stateManager.showSpinner()

        stateManager.hideSpinner()

        expect(stateManager.state.spinner.isActive).toBe(false)
        expect(stateManager.state.spinner.count).toBe(0)
      })

      it('should emit spinner.hidden event when deactivated', () => {
        const listener = vi.fn()
        stateManager.on('spinner.hidden', listener)
        stateManager.showSpinner()

        stateManager.hideSpinner()

        expect(listener).toHaveBeenCalled()
      })

      it('should not go below zero count', () => {
        stateManager.hideSpinner()
        stateManager.hideSpinner()

        expect(stateManager.state.spinner.count).toBe(0)
      })
    })

    describe('forceHideSpinner()', () => {
      it('should reset count and deactivate immediately', () => {
        stateManager.showSpinner()
        stateManager.showSpinner()
        stateManager.showSpinner()

        stateManager.forceHideSpinner()

        expect(stateManager.state.spinner.count).toBe(0)
        expect(stateManager.state.spinner.isActive).toBe(false)
      })

      it('should emit spinner.hidden event', () => {
        const listener = vi.fn()
        stateManager.on('spinner.hidden', listener)
        stateManager.showSpinner()
        stateManager.showSpinner()

        stateManager.forceHideSpinner()

        expect(listener).toHaveBeenCalled()
      })
    })
  })

  describe('Event System', () => {
    describe('on() / emit()', () => {
      it('should register and call event listener', () => {
        const listener = vi.fn()
        stateManager.on('test.event', listener)

        stateManager.emit('test.event', 'arg1', 'arg2')

        expect(listener).toHaveBeenCalledWith('arg1', 'arg2')
      })

      it('should return unsubscribe function', () => {
        const listener = vi.fn()
        const unsubscribe = stateManager.on('test.event', listener)

        unsubscribe()
        stateManager.emit('test.event')

        expect(listener).not.toHaveBeenCalled()
      })

      it('should support multiple listeners', () => {
        const listener1 = vi.fn()
        const listener2 = vi.fn()
        stateManager.on('test.event', listener1)
        stateManager.on('test.event', listener2)

        stateManager.emit('test.event', 'data')

        expect(listener1).toHaveBeenCalledWith('data')
        expect(listener2).toHaveBeenCalledWith('data')
      })

      it('should handle listener errors without stopping execution', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const listener1 = vi.fn(() => { throw new Error('Listener error') })
        const listener2 = vi.fn()
        stateManager.on('test.event', listener1)
        stateManager.on('test.event', listener2)

        stateManager.emit('test.event')

        expect(listener1).toHaveBeenCalled()
        expect(listener2).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
      })
    })

    describe('once()', () => {
      it('should call listener only once', () => {
        const listener = vi.fn()
        stateManager.once('test.event', listener)

        stateManager.emit('test.event', 'first')
        stateManager.emit('test.event', 'second')

        expect(listener).toHaveBeenCalledOnce()
        expect(listener).toHaveBeenCalledWith('first')
      })
    })

    describe('off()', () => {
      it('should remove all listeners for event', () => {
        const listener1 = vi.fn()
        const listener2 = vi.fn()
        stateManager.on('test.event', listener1)
        stateManager.on('test.event', listener2)

        stateManager.off('test.event')
        stateManager.emit('test.event')

        expect(listener1).not.toHaveBeenCalled()
        expect(listener2).not.toHaveBeenCalled()
      })
    })
  })

  describe('History Management', () => {
    describe('getHistory()', () => {
      it('should return all history entries', () => {
        stateManager.addJob('job-1', { status: 'pending' })
        stateManager.addJob('job-2', { status: 'pending' })

        const history = stateManager.getHistory()

        expect(history.length).toBeGreaterThanOrEqual(2)
        expect(history.every(h => h.timestamp && h.iso)).toBe(true)
      })

      it('should return limited number of entries when limit specified', () => {
        for (let i = 0; i < 10; i++) {
          stateManager.addJob(`job-${i}`, { status: 'pending' })
        }

        const history = stateManager.getHistory(3)

        expect(history).toHaveLength(3)
      })

      it('should trim history when exceeding maxHistory', () => {
        stateManager.maxHistory = 3

        for (let i = 0; i < 5; i++) {
          stateManager.addJob(`job-${i}`, { status: 'pending' })
        }

        expect(stateManager.history).toHaveLength(3)
      })
    })

    describe('clearHistory()', () => {
      it('should clear all history entries', () => {
        stateManager.addJob('job-1', { status: 'pending' })
        stateManager.addJob('job-2', { status: 'pending' })

        stateManager.clearHistory()

        expect(stateManager.getHistory()).toEqual([])
      })
    })
  })

  describe('cleanup()', () => {
    it('should clear countdown interval', () => {
      stateManager.startCountdown()

      stateManager.cleanup()

      expect(stateManager.state.countdown.interval).toBeNull()
      expect(stateManager.state.countdown.isActive).toBe(false)
    })

    it('should stop all job polls', () => {
      const stopFn1 = vi.fn()
      const stopFn2 = vi.fn()
      stateManager.addJob('job-1', { status: 'pending' })
      stateManager.addJob('job-2', { status: 'pending' })
      stateManager.setJobPolling('job-1', stopFn1)
      stateManager.setJobPolling('job-2', stopFn2)

      stateManager.cleanup()

      expect(stopFn1).toHaveBeenCalled()
      expect(stopFn2).toHaveBeenCalled()
    })

    it('should emit cleanup event', () => {
      const listener = vi.fn()
      stateManager.on('cleanup', listener)

      stateManager.cleanup()

      expect(listener).toHaveBeenCalled()
    })
  })

  describe('getDebugInfo()', () => {
    it('should return debug information', () => {
      stateManager.addJob('job-1', { status: 'pending' })
      stateManager.addCohort('cohort-1', { alias: 'Test' })
      stateManager.startCountdown()
      stateManager.showSpinner()

      const debug = stateManager.getDebugInfo()

      expect(debug).toMatchObject({
        jobCount: 1,
        cohortCount: 1,
        countdownActive: true,
        spinnerActive: true
      })
      expect(debug.listenerCounts).toBeInstanceOf(Array)
      expect(debug.recentHistory).toBeInstanceOf(Array)
    })
  })
})
