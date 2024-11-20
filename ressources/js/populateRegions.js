// ressources/js/populateRegions.js

import { regions } from './regionsConfig.js';

document.addEventListener('DOMContentLoaded', () => {
  const regionSelect = document.getElementById('region');

  // Populate the region select dropdown
  for (const [key, value] of Object.entries(regions)) {
    const option = document.createElement('option');
    option.value = key; // Use the assembly key as the value
    option.textContent = `${value.assembly} (${value.description}: ${value.region})`;
    regionSelect.appendChild(option);
  }
});
