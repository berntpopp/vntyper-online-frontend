// frontend/resources/js/disclaimerGate.js
// Runs before first paint (classic script, not deferred) so a first-time visitor
// sees the disclaimer immediately instead of the page followed by a pop-in once
// the module graph has loaded. modal.js takes over focus and dismissal.
if (!/(?:^|; )disclaimerAcknowledged=/.test(document.cookie)) {
  document.documentElement.classList.add('needs-disclaimer');
}
