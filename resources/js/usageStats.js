// frontend/resources/js/usageStats.js

import { safeStorage } from './utils/safeStorage.js';

/**
 * Fetches usage statistics from the server.
 * @returns {Promise<Object>} The usage statistics object.
 */
async function fetchUsageStatistics() {
  const response = await fetch(`${window.CONFIG.API_URL}/usage-statistics/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch usage statistics: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Displays the fetched usage statistics in the usageStatsContent div.
 * @param {Object} stats - The usage statistics object.
 */
function displayUsageStatistics(stats) {
  const usageStatsContent = document.getElementById('usageStatsContent');
  if (!usageStatsContent) return;
  usageStatsContent.textContent = ''; // Clear previous content

  // 1. KPI Grid (Total Jobs & Unique Users)
  const kpiGrid = document.createElement('div');
  kpiGrid.className = 'stats-kpi-grid';

  const jobsCard = document.createElement('div');
  jobsCard.className = 'stats-kpi-card';
  const jobsNumber = document.createElement('div');
  jobsNumber.className = 'stats-kpi-number';
  jobsNumber.textContent = String(stats.total_jobs ?? 0);
  const jobsLabel = document.createElement('div');
  jobsLabel.className = 'stats-kpi-label';
  jobsLabel.textContent = 'Active Jobs';
  jobsCard.appendChild(jobsNumber);
  jobsCard.appendChild(jobsLabel);

  const usersCard = document.createElement('div');
  usersCard.className = 'stats-kpi-card';
  const usersNumber = document.createElement('div');
  usersNumber.className = 'stats-kpi-number';
  usersNumber.style.color = '#0a9396';
  usersNumber.textContent = String(stats.unique_users ?? 0);
  const usersLabel = document.createElement('div');
  usersLabel.className = 'stats-kpi-label';
  usersLabel.textContent = 'Unique Users';
  usersCard.appendChild(usersNumber);
  usersCard.appendChild(usersLabel);

  kpiGrid.appendChild(jobsCard);
  kpiGrid.appendChild(usersCard);
  usageStatsContent.appendChild(kpiGrid);

  // 2. Job Statuses Section
  const statusTitle = document.createElement('div');
  statusTitle.className = 'stats-section-title';
  statusTitle.textContent = 'Active Window Statuses';
  usageStatsContent.appendChild(statusTitle);

  const pillsList = document.createElement('ul');
  pillsList.className = 'stats-pills-list';

  const statuses = stats.job_statuses || {};
  const statusEntries = Object.entries(statuses);

  if (statusEntries.length > 0) {
    for (const [status, count] of statusEntries) {
      const pill = document.createElement('li');
      pill.className = 'stats-pill';
      const sLower = status.toLowerCase();
      if (sLower.includes('complete') || sLower.includes('success')) {
        pill.classList.add('stats-pill-completed');
      } else if (
        sLower.includes('run') ||
        sLower.includes('pending') ||
        sLower.includes('progress')
      ) {
        pill.classList.add('stats-pill-running');
      } else if (sLower.includes('fail') || sLower.includes('error')) {
        pill.classList.add('stats-pill-failed');
      }
      pill.textContent = `${status}: ${count}`;
      pillsList.appendChild(pill);
    }
  } else {
    const emptyPill = document.createElement('li');
    emptyPill.className = 'stats-pill';
    emptyPill.textContent = 'No active jobs in window';
    pillsList.appendChild(emptyPill);
  }
  usageStatsContent.appendChild(pillsList);

  // 3. Cumulative Statistics (if provided by API)
  if (stats.cumulative) {
    const cumBox = document.createElement('div');
    cumBox.className = 'stats-cumulative-box';

    const cumTitle = document.createElement('div');
    cumTitle.className = 'stats-cumulative-title';
    cumTitle.textContent = 'Cumulative Usage Tracking';
    cumBox.appendChild(cumTitle);

    const cumText = document.createElement('div');
    cumText.textContent = `All-time jobs: ${stats.cumulative.total_jobs ?? 0} | All-time users: ${stats.cumulative.unique_users ?? 0}`;
    cumBox.appendChild(cumText);

    if (stats.cumulative.since) {
      const sinceDate = new Date(stats.cumulative.since);
      const formattedDate = isNaN(sinceDate.getTime())
        ? stats.cumulative.since
        : sinceDate.toLocaleDateString();
      const cumMeta = document.createElement('div');
      cumMeta.className = 'stats-cumulative-meta';
      cumMeta.textContent = `Cumulative tracking recorded since ${formattedDate}`;
      cumBox.appendChild(cumMeta);
    }

    usageStatsContent.appendChild(cumBox);
  }
}

/**
 * Initializes the usage statistics panel by setting up event listeners.
 */
export function initializeUsageStats() {
  const toggleStatsBtn = document.getElementById('toggleStatsBtn');
  const usageStatsContainer = document.getElementById('usageStatsContainer');
  const closeStatsBtn = usageStatsContainer.querySelector('.close-stats-btn');

  // Load visibility preference
  const isVisible = safeStorage.getItem('usageStatsVisible') === 'true';
  if (isVisible) {
    usageStatsContainer.classList.add('visible');
    usageStatsContainer.classList.remove('hidden');
    toggleStatsBtn.setAttribute('aria-expanded', 'true');
  } else {
    usageStatsContainer.classList.add('hidden');
    usageStatsContainer.classList.remove('visible');
    toggleStatsBtn.setAttribute('aria-expanded', 'false');
  }

  // Toggle Visibility
  toggleStatsBtn.addEventListener('click', async () => {
    const currentlyVisible = usageStatsContainer.classList.contains('visible');
    if (!currentlyVisible) {
      // Fetch and display stats when opening
      try {
        const stats = await fetchUsageStatistics();
        displayUsageStatistics(stats);
      } catch (error) {
        // XSS-safe: Use DOM API instead of innerHTML
        const usageStatsContent = document.getElementById('usageStatsContent');
        usageStatsContent.textContent = '';
        const errorP = document.createElement('p');
        errorP.style.color = 'red';
        errorP.textContent = `Error: ${error.message}`;
        usageStatsContent.appendChild(errorP);
      }
    }
    usageStatsContainer.classList.toggle('visible');
    usageStatsContainer.classList.toggle('hidden');
    toggleStatsBtn.setAttribute('aria-expanded', String(!currentlyVisible));
    safeStorage.setItem('usageStatsVisible', String(!currentlyVisible));
  });

  // Close Stats Panel
  closeStatsBtn.addEventListener('click', () => {
    usageStatsContainer.classList.add('hidden');
    usageStatsContainer.classList.remove('visible');
    toggleStatsBtn.setAttribute('aria-expanded', 'false');
    safeStorage.setItem('usageStatsVisible', 'false');
  });
}
