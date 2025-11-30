// frontend/resources/js/utils/DI.js

/**
 * Dependency Injection Container
 *
 * Purpose: Manages object dependencies and lifecycle, enabling loose coupling
 * and making code testable by allowing dependency injection and mocking.
 *
 * Benefits:
 * - Testability: Easily swap dependencies with mocks/stubs
 * - Loose Coupling: Objects don't instantiate their dependencies
 * - Single Responsibility: Container manages object creation
 * - Centralized Configuration: All dependencies defined in one place
 *
 * SOLID Principles:
 * - Dependency Inversion: Depend on abstractions (interface), not concrete classes
 * - Single Responsibility: Container only handles dependency resolution
 * - Open/Closed: Easy to extend with new dependencies without modifying existing code
 *
 * Patterns Used:
 * - Service Locator: Centralized registry for services
 * - Factory: Creates instances based on registered factories
 * - Singleton: Supports singleton instances
 *
 * @class DIContainer
 */
export class DIContainer {
  constructor() {
    /** @type {Map<string, Object>} - Registered dependencies */
    this.dependencies = new Map();

    /** @type {Map<string, Function>} - Factory functions for lazy initialization */
    this.factories = new Map();

    /** @type {Map<string, *>} - Singleton instances */
    this.singletons = new Map();

    /** @type {Map<string, string[]>} - Dependency graph for circular detection */
    this.dependencyGraph = new Map();

    /** @type {Set<string>} - Currently resolving (for circular detection) */
    this.resolving = new Set();

    /** @type {boolean} - Enable debug logging */
    this.debug = false;
  }

  /**
   * Register a dependency
   * @param {string} name - Dependency name
   * @param {* | Function} value - Value or factory function
   * @param {Object} options - Registration options
   */
  register(name, value, options = {}) {
    const { singleton = false, factory = false, override = false } = options;

    // Prevent accidental overrides
    if (this.dependencies.has(name) && !override) {
      throw new Error(`Dependency "${name}" is already registered. Use override: true to replace.`);
    }

    if (factory && typeof value !== 'function') {
      throw new Error(`Factory registration requires a function for "${name}"`);
    }

    this.dependencies.set(name, {
      value,
      singleton,
      factory,
      options,
    });

    if (this.debug) {
      console.log(`[DI] Registered "${name}"`, { singleton, factory });
    }
  }

  /**
   * Register a singleton dependency
   * @param {string} name - Dependency name
   * @param {*} value - Value or factory function
   */
  registerSingleton(name, value) {
    this.register(name, value, { singleton: true, factory: typeof value === 'function' });
  }

  /**
   * Register a factory function
   * @param {string} name - Dependency name
   * @param {Function} factoryFn - Factory function
   */
  registerFactory(name, factoryFn) {
    this.register(name, factoryFn, { factory: true });
  }

  /**
   * Resolve a dependency
   * @param {string} name - Dependency name
   * @returns {*} Resolved dependency
   */
  resolve(name) {
    // Check for circular dependencies
    if (this.resolving.has(name)) {
      const chain = Array.from(this.resolving).join(' -> ');
      throw new Error(`Circular dependency detected: ${chain} -> ${name}`);
    }

    // Check if singleton instance exists
    if (this.singletons.has(name)) {
      if (this.debug) {
        console.log(`[DI] Resolved singleton "${name}"`);
      }
      return this.singletons.get(name);
    }

    // Get registered dependency
    const dep = this.dependencies.get(name);
    if (!dep) {
      throw new Error(`Dependency "${name}" not found. Did you forget to register it?`);
    }

    try {
      // Mark as resolving (for circular detection)
      this.resolving.add(name);

      let instance;

      if (dep.factory) {
        // Call factory function
        instance = dep.value(this);
      } else {
        // Return value directly
        instance = dep.value;
      }

      // Store singleton instance
      if (dep.singleton) {
        this.singletons.set(name, instance);
      }

      if (this.debug) {
        console.log(`[DI] Resolved "${name}"`, { singleton: dep.singleton });
      }

      return instance;
    } finally {
      // Remove from resolving set
      this.resolving.delete(name);
    }
  }

  /**
   * Resolve multiple dependencies
   * @param {string[]} names - Dependency names
   * @returns {Object} Object with resolved dependencies
   */
  resolveMany(names) {
    const resolved = {};
    for (const name of names) {
      resolved[name] = this.resolve(name);
    }
    return resolved;
  }

  /**
   * Check if a dependency is registered
   * @param {string} name - Dependency name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.dependencies.has(name);
  }

  /**
   * Unregister a dependency
   * @param {string} name - Dependency name
   */
  unregister(name) {
    this.dependencies.delete(name);
    this.singletons.delete(name);
    this.dependencyGraph.delete(name);

    if (this.debug) {
      console.log(`[DI] Unregistered "${name}"`);
    }
  }

  /**
   * Clear all dependencies
   */
  clear() {
    const count = this.dependencies.size;
    this.dependencies.clear();
    this.singletons.clear();
    this.dependencyGraph.clear();
    this.resolving.clear();

    if (this.debug) {
      console.log(`[DI] Cleared ${count} dependencies`);
    }
  }

  /**
   * Get all registered dependency names
   * @returns {string[]} Dependency names
   */
  getRegistered() {
    return Array.from(this.dependencies.keys());
  }

  /**
   * Create a child container (for scoped dependencies)
   * @returns {DIContainer} Child container
   */
  createChild() {
    const child = new DIContainer();
    child.debug = this.debug;

    // Inherit parent dependencies
    for (const [name, dep] of this.dependencies.entries()) {
      child.dependencies.set(name, dep);
    }

    // Inherit singletons (shared across parent and child)
    for (const [name, instance] of this.singletons.entries()) {
      child.singletons.set(name, instance);
    }

    return child;
  }

  /**
   * Create an instance with automatic dependency injection
   * @param {Function} Constructor - Constructor function
   * @param {Object} [manualDeps={}] - Manual dependencies to override
   * @returns {*} Instance
   */
  create(Constructor, manualDeps = {}) {
    // Get constructor parameter names (basic implementation)
    const deps = this._getConstructorDeps(Constructor);

    // Resolve dependencies
    const resolvedDeps = {};
    for (const depName of deps) {
      if (manualDeps.hasOwnProperty(depName)) {
        resolvedDeps[depName] = manualDeps[depName];
      } else {
        resolvedDeps[depName] = this.resolve(depName);
      }
    }

    // Create instance
    return new Constructor(resolvedDeps);
  }

  /**
   * Extract constructor parameter names (simplified)
   * @private
   */
  _getConstructorDeps(Constructor) {
    // This is a simplified version. For production, you might want to use
    // explicit dependency declarations or a more robust parser.
    const funcStr = Constructor.toString();
    const match = funcStr.match(/constructor\s*\(\s*{\s*([^}]+)\s*}\s*\)/);

    if (!match) {
      return [];
    }

    return match[1].split(',').map(s => s.trim());
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Debug mode enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    console.log(`[DI] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get dependency info (for debugging)
   * @param {string} name - Dependency name
   * @returns {Object} Dependency info
   */
  inspect(name) {
    const dep = this.dependencies.get(name);
    if (!dep) {
      return null;
    }

    return {
      name,
      registered: true,
      singleton: dep.singleton,
      factory: dep.factory,
      hasInstance: this.singletons.has(name),
      type: typeof dep.value,
    };
  }

  /**
   * Get all dependencies info
   * @returns {Object[]} Array of dependency info
   */
  inspectAll() {
    return Array.from(this.dependencies.keys()).map(name => this.inspect(name));
  }
}

// Create and export singleton container
export const container = new DIContainer();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.__di = container;
}
