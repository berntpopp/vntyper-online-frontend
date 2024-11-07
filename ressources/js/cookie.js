// frontend/ressources/js/cookie.js

/**
 * Gets the value of a cookie by name.
 * @param {string} name - Cookie name.
 * @returns {string|null} - Cookie value or null if not found.
 */
export function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

/**
 * Sets a cookie with given name, value, and days until expiration.
 * @param {string} name - Cookie name.
 * @param {string} value - Cookie value.
 * @param {number} days - Number of days until the cookie expires.
 */
export function setCookie(name, value, days) {
    let expires = "";
    let secure = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    if (window.location.protocol === 'https:') {
        secure = "; Secure";
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax" + secure;
}
