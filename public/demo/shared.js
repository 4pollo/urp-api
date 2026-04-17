const API_BASE = window.location.origin;

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function getAccessToken() {
  return localStorage.getItem('accessToken');
}

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

function redirectToLogin() {
  clearSession();
  window.location.href = '/demo/login.html';
}

function requireAuth() {
  const token = getAccessToken();
  if (!token) {
    redirectToLogin();
    return null;
  }
  return token;
}

function createMessage(type, text) {
  const element = document.createElement('div');
  element.className = type;
  element.textContent = text;
  return element;
}

function setMessage(container, type, text) {
  if (!container) return;
  container.replaceChildren(createMessage(type, text));
}

function clearMessage(container) {
  if (!container) return;
  container.replaceChildren();
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = options.auth === false ? null : getAccessToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  const result = await response.json();

  if (result.code === 4001) {
    redirectToLogin();
    throw new Error(result.message || '登录状态已失效');
  }

  return result;
}

function createBadge(text, className = 'badge') {
  const badge = document.createElement('span');
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function createEmptyRow(colspan, text, className = 'empty-state') {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
  return row;
}
