// tests/unit/utils/EventBus.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventBus } from '../../../resources/js/utils/EventBus.js'

describe('EventBus', () => {
  let eventBus

  beforeEach(() => {
    eventBus = new EventBus()
    // Suppress console.log/error in tests unless debugging
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore all mocks to prevent test pollution
    vi.restoreAllMocks()
  })

  describe('constructor()', () => {
    it('should initialize with empty listeners map', () => {
      expect(eventBus.listeners).toBeInstanceOf(Map)
      expect(eventBus.listeners.size).toBe(0)
    })

    it('should initialize with empty event history', () => {
      expect(eventBus.eventHistory).toEqual([])
    })

    it('should set maxHistory to 100', () => {
      expect(eventBus.maxHistory).toBe(100)
    })

    it('should have debug disabled by default', () => {
      expect(eventBus.debug).toBe(false)
    })
  })

  describe('on() - Subscribe to events', () => {
    it('should subscribe handler to event', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.emit('test:event', { data: 'test' })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)
      eventBus.on('test:event', handler3)

      eventBus.emit('test:event', 'data')

      expect(handler1).toHaveBeenCalledWith('data')
      expect(handler2).toHaveBeenCalledWith('data')
      expect(handler3).toHaveBeenCalledWith('data')
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.on('test:event', handler)

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      eventBus.emit('test:event')

      expect(handler).not.toHaveBeenCalled()
    })

    it('should throw error if event name is not a string', () => {
      expect(() => eventBus.on(null, () => {})).toThrow('Event name must be a non-empty string')
      expect(() => eventBus.on(123, () => {})).toThrow('Event name must be a non-empty string')
      expect(() => eventBus.on(undefined, () => {})).toThrow('Event name must be a non-empty string')
    })

    it('should throw error if event name is empty string', () => {
      expect(() => eventBus.on('', () => {})).toThrow('Event name must be a non-empty string')
    })

    it('should throw error if callback is not a function', () => {
      expect(() => eventBus.on('test', null)).toThrow('Callback must be a function')
      expect(() => eventBus.on('test', 'not a function')).toThrow('Callback must be a function')
      expect(() => eventBus.on('test', 123)).toThrow('Callback must be a function')
    })

    it('should handle once option by auto-unsubscribing after first call', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler, { once: true })

      eventBus.emit('test:event', 'first')
      eventBus.emit('test:event', 'second')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('should log subscription in debug mode', () => {
      eventBus.setDebug(true)
      const handler = vi.fn()

      eventBus.on('test:event', handler)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Subscribed to "test:event"'),
        expect.objectContaining({ listeners: 1, once: undefined })
      )
    })
  })

  describe('once() - One-time subscription', () => {
    it('should call handler only once', () => {
      const handler = vi.fn()
      eventBus.once('test:event', handler)

      eventBus.emit('test:event', 'first')
      eventBus.emit('test:event', 'second')
      eventBus.emit('test:event', 'third')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('first')
    })

    it('should return unsubscribe function', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.once('test:event', handler)

      expect(typeof unsubscribe).toBe('function')

      // Unsubscribe before event fires
      unsubscribe()
      eventBus.emit('test:event')

      expect(handler).not.toHaveBeenCalled()
    })

    it('should clean up listener after execution', () => {
      const handler = vi.fn()
      eventBus.once('test:event', handler)

      eventBus.emit('test:event')

      expect(eventBus.listenerCount('test:event')).toBe(0)
    })
  })

  describe('off() - Unsubscribe', () => {
    it('should remove specific handler', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.off('test:event', handler)
      eventBus.emit('test:event')

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not affect other handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      eventBus.off('test:event', handler1)
      eventBus.emit('test:event')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('should clean up empty event sets', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.off('test:event', handler)

      expect(eventBus.listeners.has('test:event')).toBe(false)
    })

    it('should handle off for non-existent event gracefully', () => {
      expect(() => {
        eventBus.off('nonexistent', () => {})
      }).not.toThrow()
    })

    it('should log unsubscription in debug mode', () => {
      eventBus.setDebug(true)
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.off('test:event', handler)

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Unsubscribed from "test:event"'),
        expect.objectContaining({ remainingListeners: 0 })
      )
    })
  })

  describe('emit() - Publish events', () => {
    it('should call all handlers with provided arguments', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      eventBus.emit('test:event', 'arg1', 'arg2', { key: 'value' })

      expect(handler1).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' })
      expect(handler2).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' })
    })

    it('should return number of listeners notified', () => {
      eventBus.on('test:event', () => {})
      eventBus.on('test:event', () => {})
      eventBus.on('test:event', () => {})

      const count = eventBus.emit('test:event')

      expect(count).toBe(3)
    })

    it('should return 0 when no listeners exist', () => {
      const count = eventBus.emit('nonexistent:event')

      expect(count).toBe(0)
    })

    it('should continue executing other listeners if one throws error', () => {
      const handler1 = vi.fn(() => { throw new Error('Handler 1 error') })
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)
      eventBus.on('test:event', handler3)

      const count = eventBus.emit('test:event')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      expect(handler3).toHaveBeenCalled()
      expect(count).toBe(2) // Only handler2 and handler3 succeeded
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in listener for "test:event"'),
        expect.any(Error)
      )
    })

    it('should record event in history', () => {
      eventBus.on('test:event', () => {})
      eventBus.emit('test:event', { data: 'test' })

      const history = eventBus.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        event: 'test:event',
        args: [{ data: 'test' }],
        listenerCount: 1
      })
      expect(history[0].timestamp).toBeDefined()
    })

    it('should log emission in debug mode', () => {
      eventBus.setDebug(true)
      eventBus.on('test:event', () => {})

      eventBus.emit('test:event', { data: 'test' })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Emitted "test:event"'),
        expect.objectContaining({
          args: [{ data: 'test' }],
          listeners: 1
        })
      )
    })

    it('should not modify listeners set during iteration', () => {
      const handler1 = vi.fn(() => {
        // Try to add another listener during emit
        eventBus.on('test:event', vi.fn())
      })
      const handler2 = vi.fn()

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      // Should not throw and should call both original handlers
      expect(() => eventBus.emit('test:event')).not.toThrow()
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('emitAsync() - Publish events asynchronously', () => {
    it('should call all async handlers in sequence', async () => {
      const callOrder = []
      const handler1 = vi.fn(async () => {
        callOrder.push(1)
      })
      const handler2 = vi.fn(async () => {
        callOrder.push(2)
      })

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      await eventBus.emitAsync('test:event', 'arg')

      expect(handler1).toHaveBeenCalledWith('arg')
      expect(handler2).toHaveBeenCalledWith('arg')
      expect(callOrder).toEqual([1, 2]) // Sequential execution
    })

    it('should return number of listeners notified', async () => {
      eventBus.on('test:event', async () => {})
      eventBus.on('test:event', async () => {})

      const count = await eventBus.emitAsync('test:event')

      expect(count).toBe(2)
    })

    it('should continue executing other listeners if one throws error', async () => {
      const handler1 = vi.fn(async () => {
        throw new Error('Async handler error')
      })
      const handler2 = vi.fn(async () => {})

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      const count = await eventBus.emitAsync('test:event')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      expect(count).toBe(1) // Only handler2 succeeded
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in async listener for "test:event"'),
        expect.any(Error)
      )
    })

    it('should record event in history', async () => {
      eventBus.on('test:event', async () => {})
      await eventBus.emitAsync('test:event', 'data')

      const history = eventBus.getHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        event: 'test:event',
        args: ['data'],
        listenerCount: 1
      })
    })
  })

  describe('clear() - Remove all listeners', () => {
    it('should clear all listeners for specific event', () => {
      eventBus.on('event1', () => {})
      eventBus.on('event1', () => {})
      eventBus.on('event2', () => {})

      eventBus.clear('event1')

      expect(eventBus.listenerCount('event1')).toBe(0)
      expect(eventBus.listenerCount('event2')).toBe(1)
    })

    it('should clear all listeners for all events when no event specified', () => {
      eventBus.on('event1', () => {})
      eventBus.on('event2', () => {})
      eventBus.on('event3', () => {})

      eventBus.clear()

      expect(eventBus.listeners.size).toBe(0)
      expect(eventBus.eventNames()).toEqual([])
    })

    it('should log clearing in debug mode', () => {
      eventBus.setDebug(true)
      eventBus.on('event1', () => {})
      eventBus.on('event2', () => {})

      eventBus.clear()

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all 2 event listeners')
      )
    })
  })

  describe('listenerCount() - Get listener count', () => {
    it('should return number of listeners for event', () => {
      eventBus.on('test:event', () => {})
      eventBus.on('test:event', () => {})
      eventBus.on('test:event', () => {})

      expect(eventBus.listenerCount('test:event')).toBe(3)
    })

    it('should return 0 for event with no listeners', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0)
    })

    it('should update count after unsubscribe', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)
      expect(eventBus.listenerCount('test:event')).toBe(1)

      eventBus.off('test:event', handler)
      expect(eventBus.listenerCount('test:event')).toBe(0)
    })
  })

  describe('eventNames() - Get all event names', () => {
    it('should return array of event names with listeners', () => {
      eventBus.on('event1', () => {})
      eventBus.on('event2', () => {})
      eventBus.on('event3', () => {})

      const names = eventBus.eventNames()

      expect(names).toEqual(expect.arrayContaining(['event1', 'event2', 'event3']))
      expect(names).toHaveLength(3)
    })

    it('should return empty array when no listeners exist', () => {
      expect(eventBus.eventNames()).toEqual([])
    })

    it('should not include events after all listeners removed', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)
      eventBus.off('test:event', handler)

      expect(eventBus.eventNames()).toEqual([])
    })
  })

  describe('getHistory() - Get event history', () => {
    it('should return all event history by default', () => {
      eventBus.emit('event1', 'data1')
      eventBus.emit('event2', 'data2')
      eventBus.emit('event3', 'data3')

      const history = eventBus.getHistory()

      expect(history).toHaveLength(3)
      expect(history.map(h => h.event)).toEqual(['event1', 'event2', 'event3'])
    })

    it('should return limited number of recent events when limit specified', () => {
      eventBus.emit('event1')
      eventBus.emit('event2')
      eventBus.emit('event3')
      eventBus.emit('event4')

      const history = eventBus.getHistory(2)

      expect(history).toHaveLength(2)
      expect(history.map(h => h.event)).toEqual(['event3', 'event4'])
    })

    it('should trim history when exceeding maxHistory', () => {
      eventBus.maxHistory = 3

      eventBus.emit('event1')
      eventBus.emit('event2')
      eventBus.emit('event3')
      eventBus.emit('event4') // This should push out event1

      const history = eventBus.getHistory()

      expect(history).toHaveLength(3)
      expect(history.map(h => h.event)).toEqual(['event2', 'event3', 'event4'])
    })

    it('should return a copy of history array', () => {
      eventBus.emit('test:event')
      const history = eventBus.getHistory()

      history.push({ event: 'fake', args: [], listenerCount: 0, timestamp: 0 })

      // Original history should not be modified
      expect(eventBus.getHistory()).toHaveLength(1)
    })
  })

  describe('setDebug() - Enable/disable debug mode', () => {
    it('should enable debug mode', () => {
      eventBus.setDebug(true)

      expect(eventBus.debug).toBe(true)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Debug mode enabled')
      )
    })

    it('should disable debug mode', () => {
      eventBus.setDebug(true)
      console.log.mockClear()

      eventBus.setDebug(false)

      expect(eventBus.debug).toBe(false)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Debug mode disabled')
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle multiple subscriptions of same handler', () => {
      const handler = vi.fn()

      eventBus.on('test:event', handler)
      eventBus.on('test:event', handler) // Same handler added twice

      eventBus.emit('test:event')

      // Set only allows unique values, so handler should be called once
      expect(handler).toHaveBeenCalledOnce()
    })

    it('should handle unsubscribe during emit', () => {
      const handler2 = vi.fn()
      const handler1 = vi.fn(() => {
        // Unsubscribe handler2 during handler1 execution
        eventBus.off('test:event', handler2)
      })

      eventBus.on('test:event', handler1)
      eventBus.on('test:event', handler2)

      // Should not throw
      expect(() => eventBus.emit('test:event')).not.toThrow()
      expect(handler1).toHaveBeenCalled()
      // handler2 might or might not be called depending on iteration order
      // This is acceptable behavior
    })

    it('should handle events with no arguments', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.emit('test:event')

      expect(handler).toHaveBeenCalledWith()
    })

    it('should handle multiple arguments', () => {
      const handler = vi.fn()
      eventBus.on('test:event', handler)

      eventBus.emit('test:event', 1, 'two', { three: 3 }, [4], null, undefined)

      expect(handler).toHaveBeenCalledWith(1, 'two', { three: 3 }, [4], null, undefined)
    })
  })
})
