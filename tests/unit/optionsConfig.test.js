// frontend/tests/unit/optionsConfig.test.js

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeOptionsConfig } from '../../resources/js/uiUtils.js';

describe('initializeOptionsConfig()', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div id="additionalInputs" class="additional-inputs hidden">
        <div class="option-item" id="advntrCard">
          <label for="advntrMode">
            <input type="checkbox" id="advntrMode" name="advntr_mode">
            adVNTR Mode
          </label>
          <span class="badge-accent hidden" id="advntrEnforcedBadge">Enforced by Server</span>
        </div>
        <div class="option-item" id="normalModeCard">
          <label for="normalMode">
            <input type="checkbox" id="normalMode" name="normal_mode">
            Normal Mode
          </label>
          <span class="badge-accent hidden" id="normalModeEnforcedBadge">Enforced by Server</span>
        </div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('leaves checkboxes unchecked by default when config is false', async () => {
    const config = {
      default_advntr_mode: false,
      default_normal_mode: false,
      force_advntr_mode: false,
      force_normal_mode: false,
    };

    await initializeOptionsConfig(config);

    const advntr = /** @type {HTMLInputElement} */ (document.getElementById('advntrMode'));
    const normal = /** @type {HTMLInputElement} */ (document.getElementById('normalMode'));
    expect(advntr.checked).toBe(false);
    expect(advntr.disabled).toBe(false);
    expect(normal.checked).toBe(false);
    expect(normal.disabled).toBe(false);
  });

  it('checks boxes when default modes are enabled', async () => {
    const config = {
      default_advntr_mode: true,
      default_normal_mode: true,
      force_advntr_mode: false,
      force_normal_mode: false,
    };

    await initializeOptionsConfig(config);

    const advntr = /** @type {HTMLInputElement} */ (document.getElementById('advntrMode'));
    const normal = /** @type {HTMLInputElement} */ (document.getElementById('normalMode'));
    const advntrCard = document.getElementById('advntrCard');
    const normalCard = document.getElementById('normalModeCard');

    expect(advntr.checked).toBe(true);
    expect(advntr.disabled).toBe(false);
    expect(advntrCard?.classList.contains('active')).toBe(true);

    expect(normal.checked).toBe(true);
    expect(normal.disabled).toBe(false);
    expect(normalCard?.classList.contains('active')).toBe(true);
  });

  it('enforces and disables checkboxes when force modes are enabled', async () => {
    const config = {
      default_advntr_mode: false,
      default_normal_mode: false,
      force_advntr_mode: true,
      force_normal_mode: true,
    };

    await initializeOptionsConfig(config);

    const advntr = /** @type {HTMLInputElement} */ (document.getElementById('advntrMode'));
    const normal = /** @type {HTMLInputElement} */ (document.getElementById('normalMode'));
    const advntrBadge = document.getElementById('advntrEnforcedBadge');
    const normalBadge = document.getElementById('normalModeEnforcedBadge');
    const advntrCard = document.getElementById('advntrCard');
    const normalCard = document.getElementById('normalModeCard');

    expect(advntr.checked).toBe(true);
    expect(advntr.disabled).toBe(true);
    expect(advntrBadge?.classList.contains('hidden')).toBe(false);
    expect(advntrCard?.classList.contains('forced')).toBe(true);

    expect(normal.checked).toBe(true);
    expect(normal.disabled).toBe(true);
    expect(normalBadge?.classList.contains('hidden')).toBe(false);
    expect(normalCard?.classList.contains('forced')).toBe(true);
  });

  it('toggles active class on change events', async () => {
    await initializeOptionsConfig({
      default_advntr_mode: false,
      default_normal_mode: false,
      force_advntr_mode: false,
      force_normal_mode: false,
    });

    const advntr = /** @type {HTMLInputElement} */ (document.getElementById('advntrMode'));
    const advntrCard = document.getElementById('advntrCard');

    expect(advntrCard?.classList.contains('active')).toBe(false);

    advntr.checked = true;
    advntr.dispatchEvent(new Event('change'));
    expect(advntrCard?.classList.contains('active')).toBe(true);

    advntr.checked = false;
    advntr.dispatchEvent(new Event('change'));
    expect(advntrCard?.classList.contains('active')).toBe(false);
  });
});
