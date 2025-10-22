// resources/js/populateRegions.js

import { regions } from './regionsConfig.js';

document.addEventListener('DOMContentLoaded', () => {
  const regionSelect = document.getElementById('region');

  // Populate the region select dropdown
  for (const [key, value] of Object.entries(regions)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = value.description;
    regionSelect.appendChild(option);
  }
});
