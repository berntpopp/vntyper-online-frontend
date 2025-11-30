/**
 * DOM Helper Functions for XSS-Safe Element Creation
 *
 * This module provides safe alternatives to .innerHTML for creating DOM elements.
 * All functions use textContent and DOM API to prevent XSS attacks.
 *
 * @module domHelpers
 */

/**
 * Create a safe label+value element (XSS-proof)
 *
 * @param {string} label - The label text (e.g., "Job ID: ")
 * @param {string} value - The value to display (user input, API data, etc.)
 * @param {Object} options - Optional configuration
 * @param {string} options.containerClass - CSS class for container div
 * @param {string} options.valueTag - HTML tag for value (default: 'strong')
 * @param {string} options.valueClass - CSS class for value element
 * @returns {HTMLElement} Safe DOM element
 *
 * @example
 * // Replace: element.innerHTML = `Job ID: <strong>${jobId}</strong>`;
 * // With:
 * const element = createLabelValue('Job ID: ', jobId);
 */
export function createLabelValue(label, value, options = {}) {
  const container = document.createElement('div');

  if (options.containerClass) {
    container.className = options.containerClass;
  }

  // Label as text node (safe)
  container.appendChild(document.createTextNode(label));

  // Value in specified tag (default: strong)
  const valueTag = options.valueTag || 'strong';
  const valueElement = document.createElement(valueTag);
  valueElement.textContent = value; // Safe! No HTML parsing

  if (options.valueClass) {
    valueElement.className = options.valueClass;
  }

  container.appendChild(valueElement);

  return container;
}

/**
 * Create a safe text element
 *
 * @param {string} tag - HTML tag name (e.g., 'div', 'p', 'span')
 * @param {string} content - Text content
 * @param {Object} options - Optional configuration
 * @param {string} options.className - CSS class
 * @param {Object} options.attributes - HTML attributes to set
 * @returns {HTMLElement} Safe DOM element
 *
 * @example
 * const div = createTextElement('div', userInput, { className: 'message' });
 */
export function createTextElement(tag, content, options = {}) {
  const element = document.createElement(tag);
  element.textContent = content; // Safe! No HTML parsing

  if (options.className) {
    element.className = options.className;
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  return element;
}

/**
 * Create a link element with safe text content
 *
 * @param {string} text - Link text
 * @param {string} href - Link URL
 * @param {Object} options - Optional configuration
 * @param {string} options.className - CSS class
 * @param {string} options.target - Link target (e.g., '_blank')
 * @param {string} options.rel - Link relationship (e.g., 'noopener noreferrer')
 * @returns {HTMLAnchorElement} Safe link element
 *
 * @example
 * const link = createLink('Download', fileUrl, { className: 'btn' });
 */
export function createLink(text, href, options = {}) {
  const link = document.createElement('a');
  link.textContent = text; // Safe! No HTML parsing
  link.href = href;

  if (options.className) {
    link.className = options.className;
  }

  if (options.target) {
    link.target = options.target;
    // Automatically add security attributes for external links
    if (options.target === '_blank') {
      link.rel = options.rel || 'noopener noreferrer';
    }
  }

  return link;
}

/**
 * Replace element content safely (alternative to innerHTML)
 *
 * @param {HTMLElement} element - Target element
 * @param {string} label - Label text
 * @param {string} value - Value to display
 * @param {Object} options - Optional configuration (same as createLabelValue)
 *
 * @example
 * // Replace: element.innerHTML = `Status: <strong>${status}</strong>`;
 * // With:
 * replaceLabelValue(element, 'Status: ', status);
 */
export function replaceLabelValue(element, label, value, options = {}) {
  // Clear existing content
  element.innerHTML = '';

  // Create safe content
  const content = createLabelValue(label, value, options);

  // Move children from temp container to target element
  while (content.firstChild) {
    element.appendChild(content.firstChild);
  }
}

/**
 * Append multiple child elements safely
 *
 * @param {HTMLElement} parent - Parent element
 * @param {...(HTMLElement|string)} children - Child elements or text
 *
 * @example
 * appendChildren(container,
 *   createTextElement('p', 'Hello'),
 *   createLink('Click here', '/path')
 * );
 */
export function appendChildren(parent, ...children) {
  children.forEach(child => {
    if (typeof child === 'string') {
      parent.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      parent.appendChild(child);
    }
  });
}

/**
 * Create a list of safe elements
 *
 * @param {Array<string>} items - Array of text items
 * @param {Object} options - Optional configuration
 * @param {string} options.listType - 'ul' or 'ol' (default: 'ul')
 * @param {string} options.listClass - CSS class for list
 * @param {string} options.itemClass - CSS class for list items
 * @returns {HTMLElement} Safe list element
 *
 * @example
 * const list = createList(['Item 1', 'Item 2'], { listType: 'ul' });
 */
export function createList(items, options = {}) {
  const listType = options.listType || 'ul';
  const list = document.createElement(listType);

  if (options.listClass) {
    list.className = options.listClass;
  }

  items.forEach(itemText => {
    const li = document.createElement('li');
    li.textContent = itemText; // Safe! No HTML parsing

    if (options.itemClass) {
      li.className = options.itemClass;
    }

    list.appendChild(li);
  });

  return list;
}

/**
 * Safely query DOM element with error handling
 * Returns null if not found instead of crashing
 *
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element|null} Element or null if not found
 *
 * @example
 * const elem = safeQuerySelector('#myElement');
 * if (elem) {
 *   elem.textContent = 'Found!';
 * }
 */
export function safeQuerySelector(selector, parent = document) {
  try {
    const element = parent.querySelector(selector);
    if (!element) {
      console.warn(`[DOM] Element not found: ${selector}`);
    }
    return element;
  } catch (error) {
    console.error(`[DOM] Error querying selector '${selector}':`, error);
    return null;
  }
}

/**
 * Safely get element by ID with error handling
 * Returns null if not found instead of crashing
 *
 * @param {string} id - Element ID (without # prefix)
 * @returns {Element|null} Element or null if not found
 *
 * @example
 * const submitBtn = safeGetElementById('submitBtn');
 * if (submitBtn) {
 *   submitBtn.addEventListener('click', handleSubmit);
 * }
 */
export function safeGetElementById(id) {
  try {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`[DOM] Element not found: #${id}`);
    }
    return element;
  } catch (error) {
    console.error(`[DOM] Error getting element #${id}:`, error);
    return null;
  }
}

/**
 * Require element (throws if not found)
 * Use this for critical elements that MUST exist
 *
 * @param {string} id - Element ID (without # prefix)
 * @returns {Element} Element (guaranteed to exist)
 * @throws {Error} If element not found
 *
 * @example
 * // Use for critical initialization
 * const errorDiv = requireElementById('error');
 * errorDiv.textContent = 'App initialized';
 */
export function requireElementById(id) {
  const element = document.getElementById(id);
  if (!element) {
    const error = new Error(`Required element not found: #${id}`);
    console.error('[DOM]', error);
    throw error;
  }
  return element;
}

/**
 * Safely query all elements matching selector
 * Returns empty array if none found instead of null
 *
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (default: document)
 * @returns {Element[]} Array of elements (empty if none found)
 *
 * @example
 * const buttons = safeQuerySelectorAll('.btn');
 * buttons.forEach(btn => btn.disabled = true);
 */
export function safeQuerySelectorAll(selector, parent = document) {
  try {
    const elements = Array.from(parent.querySelectorAll(selector));
    if (elements.length === 0) {
      console.warn(`[DOM] No elements found: ${selector}`);
    }
    return elements;
  } catch (error) {
    console.error(`[DOM] Error querying selector '${selector}':`, error);
    return [];
  }
}
