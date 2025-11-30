// frontend/resources/js/faq.js

/**
 * Initializes the FAQ section with interactive elements.
 * For example, implementing an accordion for questions.
 */
export function initializeFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const question = item.querySelector('h3');
    const answer = item.querySelector('p');

    // Initially hide all answers
    answer.style.display = 'none';

    // Toggle answer visibility on question click
    question.addEventListener('click', () => {
      const isVisible = answer.style.display === 'block';
      answer.style.display = isVisible ? 'none' : 'block';
    });
  });
}
