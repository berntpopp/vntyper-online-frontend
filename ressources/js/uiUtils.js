// frontend/ressources/js/uiUtils.js

let countdownInterval = null;
let timeLeft = 20; // Countdown time in seconds

export function showSpinner() {
    const spinner = document.getElementById('spinner');
    spinner.classList.remove('hidden');
    spinner.classList.add('visible');
}

export function hideSpinner() {
    const spinner = document.getElementById('spinner');
    spinner.classList.remove('visible');
    spinner.classList.add('hidden');
}

export function startCountdown() {
    const countdownDiv = document.getElementById('countdown');
    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
    countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
        } else {
            timeLeft = 20;
            countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
        }
    }, 1000);
}

export function resetCountdown() {
    timeLeft = 20;
    const countdownDiv = document.getElementById('countdown');
    countdownDiv.textContent = `Next poll in: ${timeLeft} seconds`;
}

export function clearCountdown() {
    const countdownDiv = document.getElementById('countdown');
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        countdownDiv.textContent = '';
    }
}
