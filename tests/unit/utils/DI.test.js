// tests/unit/utils/DI.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DIContainer } from '../../../resources/js/utils/DI.js'

describe('DIContainer', () => {
  let container

  beforeEach(() => {
    container = new DIContainer()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor()', () => {
    it('should initialize with empty maps and sets', () => {
      expect(container.dependencies).toBeInstanceOf(Map)
      expect(container.dependencies.size).toBe(0)
      expect(container.factories).toBeInstanceOf(Map)
      expect(container.singletons).toBeInstanceOf(Map)
      expect(container.dependencyGraph).toBeInstanceOf(Map)
      expect(container.resolving).toBeInstanceOf(Set)
    })

    it('should have debug disabled by default', () => {
      expect(container.debug).toBe(false)
    })
  })

  // ============================================================================
  // register() - Basic registration
  // ============================================================================

  describe('register() - Basic registration', () => {
    it('should register a simple value', () => {
      // Arrange
      const value = { name: 'test' }

      // Act
      container.register('config', value)

      // Assert
      expect(container.has('config')).toBe(true)
      expect(container.dependencies.get('config')).toMatchObject({
        value,
        singleton: false,
        factory: false
      })
    })

    it('should register with singleton option', () => {
      // Act
      container.register('service', {}, { singleton: true })

      // Assert
      const dep = container.dependencies.get('service')
      expect(dep.singleton).toBe(true)
    })

    it('should register with factory option', () => {
      // Arrange
      const factory = () => ({ created: true })

      // Act
      container.register('factory', factory, { factory: true })

      // Assert
      const dep = container.dependencies.get('factory')
      expect(dep.factory).toBe(true)
      expect(dep.value).toBe(factory)
    })

    it('should prevent accidental overrides', () => {
      // Arrange
      container.register('service', { original: true })

      // Act & Assert
      expect(() => {
        container.register('service', { new: true })
      }).toThrow('Dependency "service" is already registered. Use override: true to replace.')
    })

    it('should allow override with override option', () => {
      // Arrange
      container.register('service', { original: true })

      // Act
      container.register('service', { new: true }, { override: true })

      // Assert
      expect(container.resolve('service')).toEqual({ new: true })
    })

    it('should throw error if factory is not a function', () => {
      // Act & Assert
      expect(() => {
        container.register('bad', { not: 'function' }, { factory: true })
      }).toThrow('Factory registration requires a function for "bad"')
    })

    it('should log registration in debug mode', () => {
      // Arrange
      container.debug = true

      // Act
      container.register('service', {}, { singleton: true })

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[DI] Registered "service"',
        { singleton: true, factory: false }
      )
    })
  })

  // ============================================================================
  // registerSingleton() - Convenience method
  // ============================================================================

  describe('registerSingleton()', () => {
    it('should register a singleton value', () => {
      // Arrange
      const value = { config: 'value' }

      // Act
      container.registerSingleton('config', value)

      // Assert
      const dep = container.dependencies.get('config')
      expect(dep.singleton).toBe(true)
      expect(dep.factory).toBe(false)
    })

    it('should register a singleton factory', () => {
      // Arrange
      const factory = () => ({ created: Date.now() })

      // Act
      container.registerSingleton('service', factory)

      // Assert
      const dep = container.dependencies.get('service')
      expect(dep.singleton).toBe(true)
      expect(dep.factory).toBe(true)
    })
  })

  // ============================================================================
  // registerFactory() - Convenience method
  // ============================================================================

  describe('registerFactory()', () => {
    it('should register a factory function', () => {
      // Arrange
      const factory = () => ({ id: Math.random() })

      // Act
      container.registerFactory('generator', factory)

      // Assert
      const dep = container.dependencies.get('generator')
      expect(dep.factory).toBe(true)
      expect(dep.singleton).toBe(false)
    })
  })

  // ============================================================================
  // resolve() - Basic resolution
  // ============================================================================

  describe('resolve() - Basic resolution', () => {
    it('should resolve registered value', () => {
      // Arrange
      const value = { name: 'test' }
      container.register('config', value)

      // Act
      const resolved = container.resolve('config')

      // Assert
      expect(resolved).toBe(value)
    })

    it('should throw error if dependency not found', () => {
      // Act & Assert
      expect(() => {
        container.resolve('nonexistent')
      }).toThrow('Dependency "nonexistent" not found. Did you forget to register it?')
    })
  })

  // ============================================================================
  // resolve() - Factory resolution
  // ============================================================================

  describe('resolve() - Factory resolution', () => {
    it('should call factory function and return result', () => {
      // Arrange
      const factory = vi.fn(() => ({ created: true }))
      container.registerFactory('service', factory)

      // Act
      const resolved = container.resolve('service')

      // Assert
      expect(factory).toHaveBeenCalledWith(container)
      expect(resolved).toEqual({ created: true })
    })

    it('should pass container to factory function', () => {
      // Arrange
      const factory = vi.fn((container) => ({
        fromContainer: container.resolve('config')
      }))
      container.register('config', { value: 123 })
      container.registerFactory('service', factory)

      // Act
      const resolved = container.resolve('service')

      // Assert
      expect(resolved).toEqual({ fromContainer: { value: 123 } })
    })
  })

  // ============================================================================
  // resolve() - Singleton resolution
  // ============================================================================

  describe('resolve() - Singleton resolution', () => {
    it('should return same instance for singleton', () => {
      // Arrange
      let counter = 0
      const factory = () => ({ id: ++counter })
      container.registerSingleton('service', factory)

      // Act
      const instance1 = container.resolve('service')
      const instance2 = container.resolve('service')

      // Assert
      expect(instance1).toBe(instance2)
      expect(instance1.id).toBe(1) // Factory called only once
    })

    it('should return different instances for non-singleton', () => {
      // Arrange
      let counter = 0
      const factory = () => ({ id: ++counter })
      container.registerFactory('service', factory)

      // Act
      const instance1 = container.resolve('service')
      const instance2 = container.resolve('service')

      // Assert
      expect(instance1).not.toBe(instance2)
      expect(instance1.id).toBe(1)
      expect(instance2.id).toBe(2)
    })
  })

  // ============================================================================
  // resolve() - Circular dependency detection
  // ============================================================================

  describe('resolve() - Circular dependency detection', () => {
    it('should detect circular dependencies', () => {
      // Arrange
      container.registerFactory('a', (c) => c.resolve('b'))
      container.registerFactory('b', (c) => c.resolve('a'))

      // Act & Assert
      expect(() => {
        container.resolve('a')
      }).toThrow(/Circular dependency detected/)
    })

    it('should detect self-referencing dependency', () => {
      // Arrange
      container.registerFactory('self', (c) => c.resolve('self'))

      // Act & Assert
      expect(() => {
        container.resolve('self')
      }).toThrow(/Circular dependency detected.*self -> self/)
    })

    it('should detect deep circular dependencies', () => {
      // Arrange
      container.registerFactory('a', (c) => c.resolve('b'))
      container.registerFactory('b', (c) => c.resolve('c'))
      container.registerFactory('c', (c) => c.resolve('a'))

      // Act & Assert
      expect(() => {
        container.resolve('a')
      }).toThrow(/Circular dependency detected/)
    })
  })

  // ============================================================================
  // resolveMany() - Multiple resolution
  // ============================================================================

  describe('resolveMany()', () => {
    it('should resolve multiple dependencies', () => {
      // Arrange
      container.register('a', { value: 'A' })
      container.register('b', { value: 'B' })
      container.register('c', { value: 'C' })

      // Act
      const resolved = container.resolveMany(['a', 'b', 'c'])

      // Assert
      expect(resolved).toEqual({
        a: { value: 'A' },
        b: { value: 'B' },
        c: { value: 'C' }
      })
    })

    it('should handle empty array', () => {
      // Act
      const resolved = container.resolveMany([])

      // Assert
      expect(resolved).toEqual({})
    })
  })

  // ============================================================================
  // has() - Check if dependency exists
  // ============================================================================

  describe('has()', () => {
    it('should return true if dependency is registered', () => {
      // Arrange
      container.register('service', {})

      // Assert
      expect(container.has('service')).toBe(true)
    })

    it('should return false if dependency is not registered', () => {
      // Assert
      expect(container.has('nonexistent')).toBe(false)
    })
  })

  // ============================================================================
  // unregister() - Remove dependency
  // ============================================================================

  describe('unregister()', () => {
    it('should remove dependency', () => {
      // Arrange
      container.register('service', {})

      // Act
      container.unregister('service')

      // Assert
      expect(container.has('service')).toBe(false)
    })

    it('should remove singleton instance', () => {
      // Arrange
      container.registerSingleton('service', () => ({ id: 1 }))
      container.resolve('service') // Create singleton instance

      // Act
      container.unregister('service')

      // Assert
      expect(container.singletons.has('service')).toBe(false)
    })

    it('should log unregistration in debug mode', () => {
      // Arrange
      container.debug = true
      container.register('service', {})

      // Act
      container.unregister('service')

      // Assert
      expect(console.log).toHaveBeenCalledWith('[DI] Unregistered "service"')
    })
  })

  // ============================================================================
  // clear() - Clear all dependencies
  // ============================================================================

  describe('clear()', () => {
    it('should clear all dependencies', () => {
      // Arrange
      container.register('a', {})
      container.register('b', {})
      container.registerSingleton('c', () => ({}))
      container.resolve('c') // Create singleton

      // Act
      container.clear()

      // Assert
      expect(container.dependencies.size).toBe(0)
      expect(container.singletons.size).toBe(0)
      expect(container.dependencyGraph.size).toBe(0)
      expect(container.resolving.size).toBe(0)
    })

    it('should log clear in debug mode', () => {
      // Arrange
      container.debug = true
      container.register('a', {})
      container.register('b', {})

      // Act
      container.clear()

      // Assert
      expect(console.log).toHaveBeenCalledWith('[DI] Cleared 2 dependencies')
    })
  })

  // ============================================================================
  // getRegistered() - Get all dependency names
  // ============================================================================

  describe('getRegistered()', () => {
    it('should return array of registered dependency names', () => {
      // Arrange
      container.register('a', {})
      container.register('b', {})
      container.register('c', {})

      // Act
      const registered = container.getRegistered()

      // Assert
      expect(registered).toEqual(['a', 'b', 'c'])
    })

    it('should return empty array if no dependencies', () => {
      // Act
      const registered = container.getRegistered()

      // Assert
      expect(registered).toEqual([])
    })
  })

  // ============================================================================
  // createChild() - Create child container
  // ============================================================================

  describe('createChild()', () => {
    it('should create child container with parent dependencies', () => {
      // Arrange
      container.register('config', { parent: true })

      // Act
      const child = container.createChild()

      // Assert
      expect(child).toBeInstanceOf(DIContainer)
      expect(child.has('config')).toBe(true)
      expect(child.resolve('config')).toEqual({ parent: true })
    })

    it('should share singleton instances with parent', () => {
      // Arrange
      container.registerSingleton('service', () => ({ id: Math.random() }))
      const parentInstance = container.resolve('service')

      // Act
      const child = container.createChild()
      const childInstance = child.resolve('service')

      // Assert
      expect(childInstance).toBe(parentInstance) // Same instance
    })

    it('should inherit debug mode', () => {
      // Arrange
      container.debug = true

      // Act
      const child = container.createChild()

      // Assert
      expect(child.debug).toBe(true)
    })

    it('should allow child to override parent dependencies', () => {
      // Arrange
      container.register('config', { parent: true })
      const child = container.createChild()

      // Act
      child.register('config', { child: true }, { override: true })

      // Assert
      expect(child.resolve('config')).toEqual({ child: true })
      expect(container.resolve('config')).toEqual({ parent: true }) // Parent unchanged
    })
  })

  // ============================================================================
  // create() - Auto-injection
  // ============================================================================

  describe('create() - Auto-injection', () => {
    it('should create instance with auto-injected dependencies', () => {
      // Arrange
      class TestService {
        constructor({ config, logger }) {
          this.config = config
          this.logger = logger
        }
      }

      container.register('config', { api: 'http://localhost' })
      container.register('logger', console)

      // Act
      const instance = container.create(TestService)

      // Assert
      expect(instance).toBeInstanceOf(TestService)
      expect(instance.config).toEqual({ api: 'http://localhost' })
      expect(instance.logger).toBe(console)
    })

    it('should allow manual dependency override', () => {
      // Arrange
      class TestService {
        constructor({ config }) {
          this.config = config
        }
      }

      container.register('config', { default: true })

      // Act
      const instance = container.create(TestService, { config: { manual: true } })

      // Assert
      expect(instance.config).toEqual({ manual: true })
    })
  })

  // ============================================================================
  // setDebug() - Debug mode
  // ============================================================================

  describe('setDebug()', () => {
    it('should enable debug mode', () => {
      // Act
      container.setDebug(true)

      // Assert
      expect(container.debug).toBe(true)
      expect(console.log).toHaveBeenCalledWith('[DI] Debug mode enabled')
    })

    it('should disable debug mode', () => {
      // Arrange
      container.debug = true

      // Act
      container.setDebug(false)

      // Assert
      expect(container.debug).toBe(false)
      expect(console.log).toHaveBeenCalledWith('[DI] Debug mode disabled')
    })
  })

  // ============================================================================
  // inspect() - Get dependency info
  // ============================================================================

  describe('inspect()', () => {
    it('should return dependency info', () => {
      // Arrange
      container.registerSingleton('service', () => ({ id: 1 }))

      // Act
      const info = container.inspect('service')

      // Assert
      expect(info).toMatchObject({
        name: 'service',
        registered: true,
        singleton: true,
        factory: true,
        hasInstance: false,
        type: 'function'
      })
    })

    it('should return null if dependency not found', () => {
      // Act
      const info = container.inspect('nonexistent')

      // Assert
      expect(info).toBeNull()
    })

    it('should show hasInstance true for resolved singletons', () => {
      // Arrange
      container.registerSingleton('service', () => ({ id: 1 }))
      container.resolve('service') // Resolve to create instance

      // Act
      const info = container.inspect('service')

      // Assert
      expect(info.hasInstance).toBe(true)
    })
  })

  // ============================================================================
  // inspectAll() - Get all dependency info
  // ============================================================================

  describe('inspectAll()', () => {
    it('should return info for all dependencies', () => {
      // Arrange
      container.register('a', {})
      container.registerSingleton('b', () => ({}))
      container.registerFactory('c', () => ({}))

      // Act
      const allInfo = container.inspectAll()

      // Assert
      expect(allInfo).toHaveLength(3)
      expect(allInfo[0].name).toBe('a')
      expect(allInfo[1].name).toBe('b')
      expect(allInfo[2].name).toBe('c')
    })

    it('should return empty array if no dependencies', () => {
      // Act
      const allInfo = container.inspectAll()

      // Assert
      expect(allInfo).toEqual([])
    })
  })
})
