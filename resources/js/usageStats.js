// frontend/resources/js/usageStats.js

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
  usageStatsContent.innerHTML = ''; // Clear previous content

  // XSS-safe: Use DOM API instead of innerHTML
  const totalJobs = document.createElement('p');
  const totalJobsStrong = document.createElement('strong');
  totalJobsStrong.textContent = 'Total Jobs:';
  totalJobs.appendChild(totalJobsStrong);
  totalJobs.appendChild(document.createTextNode(` ${stats.total_jobs}`));

  const uniqueUsers = document.createElement('p');
  const uniqueUsersStrong = document.createElement('strong');
  uniqueUsersStrong.textContent = 'Unique Users:';
  uniqueUsers.appendChild(uniqueUsersStrong);
  uniqueUsers.appendChild(document.createTextNode(` ${stats.unique_users}`));

  const jobStatuses = document.createElement('div');
  const jobStatusesStrong = document.createElement('strong');
  jobStatusesStrong.textContent = 'Job Statuses:';
  jobStatuses.appendChild(jobStatusesStrong);

  const jobList = document.createElement('ul');
  for (const [status, count] of Object.entries(stats.job_statuses)) {
    const li = document.createElement('li');
    li.textContent = `${status}: ${count}`;
    jobList.appendChild(li);
  }
  jobStatuses.appendChild(jobList);

  usageStatsContent.appendChild(totalJobs);
  usageStatsContent.appendChild(uniqueUsers);
  usageStatsContent.appendChild(jobStatuses);
}

/**
 * Initializes the usage statistics panel by setting up event listeners.
 */
export function initializeUsageStats() {
  const toggleStatsBtn = document.getElementById('toggleStatsBtn');
  const usageStatsContainer = document.getElementById('usageStatsContainer');
  const closeStatsBtn = usageStatsContainer.querySelector('.close-stats-btn');

  // Load visibility preference
  const isVisible = localStorage.getItem('usageStatsVisible') === 'true';
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
    toggleStatsBtn.setAttribute('aria-expanded', !currentlyVisible);
    localStorage.setItem('usageStatsVisible', !currentlyVisible);
  });

  // Close Stats Panel
  closeStatsBtn.addEventListener('click', () => {
    usageStatsContainer.classList.add('hidden');
    usageStatsContainer.classList.remove('visible');
    toggleStatsBtn.setAttribute('aria-expanded', 'false');
    localStorage.setItem('usageStatsVisible', 'false');
  });
}
