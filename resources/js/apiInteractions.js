// frontend/resources/js/apiInteractions.js

import { logMessage } from './log.js';
import { pollingManager } from './pollingManager.js';
import { fetchWithTimeout, parseErrorResponse, retryRequest } from './services/httpUtils.js';

/**
 * Internal helper: Make API request with timeout and error parsing
 *
 * Centralizes fetch logic with:
 * - Timeout protection (30s default)
 * - Unified error parsing
 * - Optional retry for transient failures
 *
 * @private
 * @param {string} url - The API endpoint URL
 * @param {Object} [options={}] - Fetch options (method, headers, body)
 * @param {boolean} [shouldRetry=false] - Whether to retry on failure
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} Parsed error with metadata
 */
async function apiRequest(url, options = {}, shouldRetry = false) {
  const performRequest = async () => {
    // Fetch with 30s timeout
    const response = await fetchWithTimeout(url, options, 30000);

    // Parse error if request failed
    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    // Return parsed JSON
    return response.json();
  };

  // Retry for one-shot requests (submit, create)
  // Polling requests use PollingManager's retry (avoid duplication)
  if (shouldRetry) {
    return retryRequest(performRequest, 3, 1000);
  }

  return performRequest();
}

/**
 * Submits a job or batch of jobs to the backend API.
 *
 * ONE-SHOT REQUEST: Uses retry for transient failures (3 attempts, exponential backoff)
 *
 * @param {FormData} formData - The form data containing job parameters and files
 * @param {string|null} [cohortId=null] - Optional cohort ID to associate the jobs with
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort
 * @returns {Promise<Object>} The JSON response from the API
 * @throws {Error} If the submission fails after retries
 */
export async function submitJobToAPI(formData, cohortId = null, passphrase = null) {
  try {
    logMessage('Submitting job(s) to the API...', 'info');

    // Validate cohortId if provided
    if (cohortId) {
      if (typeof cohortId !== 'string' || cohortId.trim() === '') {
        logMessage('Invalid Cohort ID provided to submitJobToAPI.', 'error');
        throw new Error('Invalid Cohort ID provided.');
      }
      formData.append('cohort_id', cohortId);
      logMessage(`Associating jobs with Cohort ID: ${cohortId}`, 'info');

      // Validate passphrase if provided
      if (passphrase) {
        if (typeof passphrase !== 'string') {
          logMessage('Passphrase must be a string in submitJobToAPI.', 'error');
          throw new Error('Passphrase must be a string.');
        }
        formData.append('passphrase', passphrase);
        logMessage('Passphrase included in job submission.', 'info');
      }
    }

    // Submit with retry (one-shot request)
    const data = await apiRequest(
      `${window.CONFIG.API_URL}/run-job/`,
      { method: 'POST', body: formData },
      true // shouldRetry = true
    );

    logMessage(`Job(s) submitted successfully! Job ID(s): ${data.job_id}`, 'success');
    return data;
  } catch (error) {
    logMessage(`Error in submitJobToAPI: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Fetches the current status of a job from the backend API.
 *
 * Used by polling - NO retry (PollingManager handles retry)
 *
 * @param {string} jobId - The unique identifier of the job
 * @returns {Promise<Object>} The JSON response containing job status and details
 * @throws {Error} If the request fails or jobId is invalid
 */
export async function getJobStatus(jobId) {
  // Validate jobId
  if (typeof jobId !== 'string' || jobId.trim() === '') {
    logMessage('getJobStatus called with invalid Job ID.', 'error');
    throw new Error('Invalid Job ID provided.');
  }

  try {
    logMessage(`Fetching status for Job ID: ${jobId}`, 'info');

    // No retry - PollingManager handles retry
    const data = await apiRequest(
      `${window.CONFIG.API_URL}/job-status/${encodeURIComponent(jobId)}/`,
      {},
      false // shouldRetry = false
    );

    logMessage(`Status fetched for Job ID ${jobId}: ${data.status}`, 'info');
    return data;
  } catch (error) {
    logMessage(`Error in getJobStatus for Job ID ${jobId}: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Fetches the current status of a cohort from the backend API.
 *
 * Used by polling - NO retry (PollingManager handles retry)
 *
 * @param {string} cohortId - The unique identifier of the cohort
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort
 * @param {string|null} [alias=null] - Optional alias for the cohort
 * @returns {Promise<Object>} The JSON response containing cohort status and job details
 * @throws {Error} If the request fails or cohortId is invalid
 */
export async function getCohortStatus(cohortId, passphrase = null, alias = null) {
  // Validate cohortId
  if (typeof cohortId !== 'string' || cohortId.trim() === '') {
    logMessage('getCohortStatus called with invalid Cohort ID.', 'error');
    throw new Error('Invalid Cohort ID provided.');
  }

  try {
    logMessage(`Fetching status for Cohort ID: ${cohortId}`, 'info');

    // Construct URL with optional passphrase and alias
    let url = `${window.CONFIG.API_URL}/cohort-status/?cohort_id=${encodeURIComponent(cohortId)}`;

    if (passphrase) {
      if (typeof passphrase !== 'string') {
        logMessage('Passphrase must be a string in getCohortStatus.', 'error');
        throw new Error('Passphrase must be a string.');
      }
      url += `&passphrase=${encodeURIComponent(passphrase)}`;
      logMessage('Passphrase included in cohort status request.', 'info');
    }

    if (alias) {
      if (typeof alias !== 'string') {
        logMessage('Alias must be a string in getCohortStatus.', 'error');
        throw new Error('Alias must be a string.');
      }
      url += `&alias=${encodeURIComponent(alias)}`;
      logMessage('Alias included in cohort status request.', 'info');
    }

    // No retry - PollingManager handles retry
    const data = await apiRequest(url, {}, false);

    logMessage(`Status fetched for Cohort ID ${cohortId}: ${data.status}`, 'info');
    return data;
  } catch (error) {
    logMessage(`Error in getCohortStatus for Cohort ID ${cohortId}: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Polls the job status from the backend API at regular intervals.
 * Uses PollingManager for deduplication, retry logic, and proper cleanup.
 *
 * NOTE: PollingManager provides retry + exponential backoff, so getJobStatus
 * doesn't need its own retry logic.
 *
 * @param {string} jobId - The unique identifier of the job
 * @param {Function} onStatusUpdate - Callback function to handle status updates
 * @param {Function} onComplete - Callback function when the job is completed
 * @param {Function} onError - Callback function when an error occurs
 * @param {Function} [onPoll=null] - Optional callback function when a poll is made
 * @param {Function} [onQueueUpdate=null] - Optional callback function to handle queue updates
 * @returns {Function} A function to stop the polling
 */
export function pollJobStatusAPI(
  jobId,
  onStatusUpdate,
  onComplete,
  onError,
  onPoll = null,
  onQueueUpdate = null
) {
  // Poll function that fetches and processes job status
  const pollFn = async () => {
    if (onPoll && typeof onPoll === 'function') {
      onPoll();
    }

    // Fetch current job status
    const data = await getJobStatus(jobId);

    // Update status using the provided callback
    onStatusUpdate(data.status);
    logMessage(`Job ID ${jobId} status updated to: ${data.status}`, 'info');

    // Handle additional job details if available
    if (data.details) {
      logMessage(`Job ID ${jobId} details: ${JSON.stringify(data.details)}`, 'info');
    }

    // Fetch job queue position if applicable
    if (onQueueUpdate && typeof onQueueUpdate === 'function') {
      try {
        const queueData = await getJobQueueStatus(jobId);
        onQueueUpdate(queueData);
        logMessage(`Queue data updated for Job ID ${jobId}: ${JSON.stringify(queueData)}`, 'info');
      } catch (queueError) {
        logMessage(
          `Error fetching job queue status for Job ID ${jobId}: ${queueError.message}`,
          'error'
        );
      }
    }

    // Return the data with status for PollingManager to check
    return data;
  };

  // Start polling using PollingManager
  const stopPolling = pollingManager.start(`job-${jobId}`, pollFn, {
    interval: 5000, // 5 seconds
    maxRetries: 20, // More retries for job polling
    maxDuration: 3600000, // 1 hour max
    onUpdate: _data => {
      // Already handled in pollFn
    },
    onComplete: data => {
      logMessage(`PollingManager onComplete callback triggered for Job ID ${jobId}. Data:`, 'info');
      logMessage(JSON.stringify(data), 'info');

      if (data.status === 'completed') {
        logMessage(`Job ID ${jobId} has been completed. Calling onComplete callback...`, 'success');
        onComplete();
        logMessage(`onComplete callback executed for Job ID ${jobId}.`, 'success');
      } else if (data.status === 'failed') {
        const errorMsg = data.error || 'Job failed.';
        logMessage(`Job ID ${jobId} failed with error: ${errorMsg}`, 'error');
        onError(errorMsg);
      }
    },
    onError: error => {
      logMessage(`Error polling status for Job ID ${jobId}: ${error.message}`, 'error');
      onError(error.message);
    },
  });

  return stopPolling;
}

/**
 * Polls the cohort status from the backend API at regular intervals.
 * Uses PollingManager for deduplication, retry logic, and proper cleanup.
 *
 * NOTE: PollingManager provides retry + exponential backoff, so getCohortStatus
 * doesn't need its own retry logic.
 *
 * @param {string} cohortId - The unique identifier of the cohort
 * @param {Function} onStatusUpdate - Callback function to handle status updates
 * @param {Function} onComplete - Callback function when the cohort is completed
 * @param {Function} onError - Callback function when an error occurs
 * @param {Function} [onPoll=null] - Optional callback function when a poll is made
 * @param {string|null} [passphrase=null] - Optional passphrase for the cohort
 * @returns {Function} A function to stop the polling
 */
export function pollCohortStatusAPI(
  cohortId,
  onStatusUpdate,
  onComplete,
  onError,
  onPoll = null,
  passphrase = null
) {
  // Poll function that fetches and processes cohort status
  const pollFn = async () => {
    if (onPoll && typeof onPoll === 'function') {
      onPoll();
      logMessage(`Polling initiated for Cohort ID: ${cohortId}`, 'info');
    }

    // Fetch current cohort status
    const data = await getCohortStatus(cohortId, passphrase);

    // Update status using the provided callback
    onStatusUpdate(data);

    // Validate cohort data
    if (!data.jobs || !Array.isArray(data.jobs)) {
      logMessage(`Invalid cohort status data for Cohort ID ${cohortId}.`, 'error');
      throw new Error('Invalid cohort status data.');
    }

    // Check if all jobs completed
    const allCompleted = data.jobs.every(job => job.status === 'completed');

    // Return data with synthetic status for PollingManager
    return {
      ...data,
      status: allCompleted ? 'completed' : data.status === 'failed' ? 'failed' : 'processing',
    };
  };

  // Start polling using PollingManager
  const stopPolling = pollingManager.start(`cohort-${cohortId}`, pollFn, {
    interval: 5000, // 5 seconds
    maxRetries: 20, // More retries for cohort polling
    maxDuration: 3600000, // 1 hour max
    onUpdate: _data => {
      // Already handled in pollFn
    },
    onComplete: data => {
      if (data.jobs && Array.isArray(data.jobs)) {
        const allCompleted = data.jobs.every(job => job.status === 'completed');

        if (allCompleted) {
          logMessage(`All jobs in Cohort ID ${cohortId} have been completed.`, 'success');
          onComplete();
        } else if (data.status === 'failed') {
          const errorMsg = data.error || 'Cohort processing failed.';
          logMessage(`Cohort ID ${cohortId} failed with error: ${errorMsg}`, 'error');
          onError(errorMsg);
        }
      }
    },
    onError: error => {
      logMessage(`Error polling status for Cohort ID ${cohortId}: ${error.message}`, 'error');
      onError(error.message);
    },
  });

  return stopPolling;
}

/**
 * Fetches the job queue status from the backend API.
 *
 * Used occasionally - NO retry (quick status check)
 *
 * @param {string} [jobId] - Optional job ID to get position in the queue
 * @returns {Promise<Object>} The JSON response from the API
 * @throws {Error} If the request fails
 */
export async function getJobQueueStatus(jobId) {
  try {
    logMessage(`Fetching queue status${jobId ? ` for Job ID: ${jobId}` : ''}`, 'debug');

    let url = `${window.CONFIG.API_URL}/job-queue/`;
    if (jobId) {
      url += `?job_id=${encodeURIComponent(jobId)}`;
    }

    // No retry - quick status check
    const data = await apiRequest(url, {}, false);

    logMessage(
      `Queue status fetched${jobId ? ` for Job ID ${jobId}` : ''}: ${JSON.stringify(data)}`,
      'info'
    );
    return data;
  } catch (error) {
    logMessage(
      `Error in getJobQueueStatus${jobId ? ` for Job ID ${jobId}` : ''}: ${error.message}`,
      'debug'
    );
    throw error;
  }
}

/**
 * Creates a cohort by sending a POST request to the backend API.
 *
 * ONE-SHOT REQUEST: Uses retry for transient failures (3 attempts, exponential backoff)
 *
 * @param {string} alias - The cohort alias provided by the user
 * @param {string|null} [passphrase=null] - The passphrase for the cohort (optional)
 * @returns {Promise<Object>} The created cohort object containing cohort_id and alias
 * @throws {Error} If the cohort creation fails after retries or input is invalid
 */
export async function createCohort(alias, passphrase = null) {
  // Validate alias
  if (typeof alias !== 'string' || alias.trim() === '') {
    logMessage('createCohort called with invalid alias.', 'error');
    throw new Error('Invalid alias provided.');
  }

  // Validate passphrase if provided
  if (passphrase !== null && typeof passphrase !== 'string') {
    logMessage('Passphrase must be a string in createCohort.', 'error');
    throw new Error('Passphrase must be a string.');
  }

  try {
    logMessage(`Creating cohort with alias: ${alias}`, 'info');

    // Construct URL-encoded payload
    const params = new URLSearchParams();
    params.append('alias', alias);
    if (passphrase) params.append('passphrase', passphrase);

    // Create with retry (one-shot request)
    const data = await apiRequest(
      `${window.CONFIG.API_URL}/create-cohort/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
      true // shouldRetry = true
    );

    logMessage(`Cohort created successfully! Cohort ID: ${data.cohort_id}`, 'success');
    return data;
  } catch (error) {
    logMessage(`Error in createCohort: ${error.message}`, 'error');
    throw error;
  }
}
