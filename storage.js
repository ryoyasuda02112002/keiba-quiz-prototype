const PREFIX = 'keiba-quiz:v1';
const key = (date) => `${PREFIX}:attempt:${date}`;
export function loadAttempt(date) { try { const parsed = JSON.parse(localStorage.getItem(key(date)) ?? 'null'); return parsed?.version === 1 ? parsed : null; } catch { return null; } }
export function saveAttempt(attempt) { localStorage.setItem(key(attempt.setDate), JSON.stringify(attempt)); localStorage.setItem(`${PREFIX}:last-result`, JSON.stringify(attempt)); }
export function clearAttempt(date) { localStorage.removeItem(key(date)); }
