// frontend/resources/js/faq.js

/**
 * Initializes the FAQ accordion with interactive elements.
 * Supports accessible button triggers, keyboard interaction, and multi-element answers.
 */
export function initializeFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const trigger = /** @type {HTMLElement | null} */ (
      item.querySelector('.faq-trigger') || item.querySelector('h3')
    );
    const answer = /** @type {HTMLElement | null} */ (
      item.querySelector('.faq-answer') || item.querySelector('p')
    );

    if (!trigger || !answer) return;

    const isButton = trigger.tagName.toLowerCase() === 'button';

    trigger.addEventListener('click', () => {
      const isExpanded = isButton
        ? trigger.getAttribute('aria-expanded') === 'true'
        : trigger.classList.contains('active');

      const nextState = !isExpanded;

      if (isButton) {
        trigger.setAttribute('aria-expanded', String(nextState));
      } else {
        trigger.classList.toggle('active', nextState);
      }

      if ('hidden' in answer) {
        answer.hidden = !nextState;
      }
      answer.style.display = nextState ? 'block' : 'none';
      answer.classList.toggle('visible', nextState);
    });
  });
}
