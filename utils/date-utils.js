/**
 * Shared utility functions for date and time operations
 */

/**
 * Generates a timestamp string for filenames in YYYY-MM-DD_HH-mm-ss format using UTC.
 * @param {Date} [date=new Date()] - The date object to use (defaults to now)
 * @returns {string} - The formatted timestamp string
 */
function generateFilenameTimestamp(date = new Date()) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
}

module.exports = {
    generateFilenameTimestamp
};
