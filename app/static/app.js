/**
 * Meeting Request Dashboard - Frontend Application
 * Modern vanilla JS dashboard for managing meeting requests
 */

// ============================================
// Configuration & State
// ============================================
const API_BASE = '/api';
const WS_URL = `ws://${window.location.host}/ws`;

let state = {
    meetings: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    search: '',
    statusFilter: '',
    sortBy: 'created_at:desc',
    currentMeeting: null,
    ws: null,
    wsReconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    settings: {
        host: '0.0.0.0',
        port: 5687,
        path: '/webhook/req-meeting'
    },
    theme: 'light' // 'light' or 'dark'
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Navigation
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarCollapseToggle: document.getElementById('sidebar-collapse-toggle'),
    navItems: document.querySelectorAll('.nav-item'),
    pages: document.querySelectorAll('.page'),

    // Theme Toggle
    themeToggle: document.getElementById('theme-toggle'),
    themeToggleSun: document.querySelector('#theme-toggle .icon-sun'),
    themeToggleMoon: document.querySelector('#theme-toggle .icon-moon'),

    // Dashboard
    searchInput: document.getElementById('search-input'),
    statusFilter: document.getElementById('status-filter'),
    sortSelect: document.getElementById('sort-select'),
    pageSizeSelect: document.getElementById('page-size-select'),
    meetingsTbody: document.getElementById('meetings-tbody'),
    emptyState: document.getElementById('empty-state'),
    tableContainer: document.querySelector('.table-container'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    paginationInfo: document.getElementById('pagination-info'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshEmpty: document.getElementById('refresh-empty'),
    exportJson: document.getElementById('export-json'),
    exportCsv: document.getElementById('export-csv'),

    // Stats
    statTotal: document.getElementById('stat-total'),
    statActive: document.getElementById('stat-active'),
    statInactive: document.getElementById('stat-inactive'),
    statToday: document.getElementById('stat-today'),

    // Settings
    settingHost: document.getElementById('setting-host'),
    settingPort: document.getElementById('setting-port'),
    settingPath: document.getElementById('setting-path'),
    settingsWebhookUrl: document.getElementById('settings-webhook-url'),
    webhookUrlPreview: document.getElementById('webhook-url'),
    copyWebhookUrl: document.getElementById('copy-webhook-url'),
    copySettingsUrl: document.getElementById('copy-settings-url'),
    saveSettings: document.getElementById('save-settings'),
    resetSettings: document.getElementById('reset-settings'),
    appVersion: document.getElementById('app-version'),
    appEnv: document.getElementById('app-env'),
    appDb: document.getElementById('app-db'),

    // WebSocket Status
    wsStatus: document.getElementById('ws-status'),
    wsStatusText: document.getElementById('ws-status-text'),

    // Modals
    detailModal: document.getElementById('detail-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalDownload: document.getElementById('modal-download'),

    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmBody: document.getElementById('confirm-body'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmOk: document.getElementById('confirm-ok'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
};

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDateShort(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDuration(minutes) {
    if (!minutes && minutes !== 0) return '-';
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}min`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Theme Functions
// ============================================
function initTheme() {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        state.theme = savedTheme;
    } else if (prefersDark) {
        state.theme = 'dark';
    }

    applyTheme(state.theme);
}

function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcons();
}

function toggleTheme() {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

function updateThemeIcons() {
    if (elements.themeToggleSun && elements.themeToggleMoon) {
        if (state.theme === 'dark') {
            elements.themeToggleSun.style.display = 'none';
            elements.themeToggleMoon.style.display = 'block';
        } else {
            elements.themeToggleSun.style.display = 'block';
            elements.themeToggleMoon.style.display = 'none';
        }
    }
}

// ============================================
// API Functions
// ============================================
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

async function fetchMeetings() {
    const params = new URLSearchParams({
        page: state.page,
        page_size: state.pageSize,
    });

    if (state.search) params.append('search', state.search);
    if (state.statusFilter !== '') params.append('is_active', state.statusFilter);
    params.append('sort', state.sortBy);

    const data = await apiRequest(`/meetings?${params.toString()}`);
    state.meetings = data.items;
    state.total = data.total;
    state.page = data.page;
    state.pageSize = data.page_size;
    state.totalPages = data.total_pages;

    updateStats();
    renderMeetingsTable();
    updatePagination();
}

async function fetchMeeting(id) {
    return apiRequest(`/meetings/${id}`);
}

async function updateMeeting(id, data) {
    return apiRequest(`/meetings/${id}`, {
        method: 'PATCH',
        body: data,
    });
}

async function deleteMeeting(id) {
    return apiRequest(`/meetings/${id}`, { method: 'DELETE' });
}

async function exportMeetingsJson() {
    return apiRequest('/meetings/export/all');
}

async function exportMeetingsCsv() {
    const response = await fetch(`${API_BASE}/meetings/export/csv`);
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
}

async function fetchSettings() {
    return apiRequest('/settings');
}

async function fetchWebhookUrl() {
    return apiRequest('/settings/webhook-url');
}

async function updateSetting(key, value, description) {
    return apiRequest(`/settings/${key}`, {
        method: 'PUT',
        body: { value, description },
    });
}

async function initializeDefaultSettings() {
    return apiRequest('/settings/initialize-defaults', { method: 'POST' });
}

// ============================================
// WebSocket Functions
// ============================================
function connectWebSocket() {
    if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    updateWsStatus('connecting');

    try {
        state.ws = new WebSocket(WS_URL);

        state.ws.onopen = () => {
            console.log('WebSocket connected');
            state.wsReconnectAttempts = 0;
            updateWsStatus('connected');
        };

        state.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (e) {
                console.error('Failed to parse WS message:', e);
            }
        };

        state.ws.onclose = () => {
            console.log('WebSocket disconnected');
            updateWsStatus('disconnected');
            scheduleReconnect();
        };

        state.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateWsStatus('error');
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e);
        updateWsStatus('error');
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (state.wsReconnectAttempts >= state.maxReconnectAttempts) {
        console.log('Max reconnect attempts reached');
        updateWsStatus('disconnected');
        return;
    }

    const delay = state.reconnectDelay * Math.pow(2, state.wsReconnectAttempts);
    state.wsReconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${state.wsReconnectAttempts})`);
    setTimeout(connectWebSocket, delay);
}

function updateWsStatus(status) {
    const indicator = elements.wsStatus;
    const text = elements.wsStatusText;

    indicator.className = 'status-indicator';
    switch (status) {
        case 'connected':
            indicator.classList.add('connected');
            text.textContent = 'Connected';
            break;
        case 'connecting':
            indicator.classList.add('connecting');
            text.textContent = 'Connecting...';
            break;
        case 'disconnected':
            text.textContent = 'Disconnected';
            break;
        case 'error':
            text.textContent = 'Error';
            break;
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'meeting_created':
            showToast('New meeting request received!', 'success');
            fetchMeetings();
            break;
        case 'meeting_updated':
            fetchMeetings();
            break;
        case 'meeting_deleted':
            fetchMeetings();
            break;
        case 'pong':
            // Heartbeat response
            break;
    }
}

function sendWsMessage(message) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify(message));
    }
}

// ============================================
// Render Functions
// ============================================
function updateStats() {
    const active = state.meetings.filter(m => m.is_active).length;
    const inactive = state.meetings.filter(m => !m.is_active).length;
    const today = state.meetings.filter(m => {
        const meetingDate = new Date(m.created_at).toDateString();
        const todayDate = new Date().toDateString();
        return meetingDate === todayDate;
    }).length;

    elements.statTotal.textContent = state.total;
    elements.statActive.textContent = active;
    elements.statInactive.textContent = inactive;
    elements.statToday.textContent = today;
}

function renderMeetingsTable() {
    const tbody = elements.meetingsTbody;
    const emptyState = elements.emptyState;

    if (state.meetings.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        elements.tableContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'block';

    tbody.innerHTML = state.meetings.map(meeting => `
        <tr data-id="${meeting.id}">
            <td class="cell-name">${escapeHtml(meeting.user_name)}</td>
            <td class="cell-email">${escapeHtml(meeting.user_email)}</td>
            <td class="cell-time">${formatDate(meeting.meeting_time)}</td>
            <td class="cell-duration">${formatDuration(meeting.meeting_duration)}</td>
            <td class="cell-company">${escapeHtml(meeting.company_name || '-')}</td>
            <td class="cell-recruiter">${escapeHtml(meeting.recruiter_name || '-')}</td>
            <td>
                <span class="status-badge ${meeting.is_active ? 'active' : 'inactive'}">
                    ${meeting.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view" data-action="view" data-id="${meeting.id}" title="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="action-btn toggle" data-action="toggle" data-id="${meeting.id}" title="${meeting.is_active ? 'Deactivate' : 'Activate'}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${meeting.is_active
                                ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
                                : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
                        </svg>
                    </button>
                    <button class="action-btn download" data-action="download" data-id="${meeting.id}" title="Download JSON">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" data-action="delete" data-id="${meeting.id}" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Add click handlers for action buttons
    tbody.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id, 10);
            handleAction(action, id);
        });
    });

    // Row click for view details
    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const id = parseInt(row.dataset.id, 10);
            handleAction('view', id);
        });
    });
}

function updatePagination() {
    elements.paginationInfo.textContent = `Page ${state.page} of ${state.totalPages || 1}`;
    elements.prevPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= state.totalPages;
}

function renderMeetingDetail(meeting) {
    state.currentMeeting = meeting;
    elements.modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-label">ID</div>
            <div class="detail-value"><code>${meeting.id}</code></div>

            <div class="detail-label">Name</div>
            <div class="detail-value">${escapeHtml(meeting.user_name)}</div>

            <div class="detail-label">Email</div>
            <div class="detail-value">${escapeHtml(meeting.user_email)}</div>

            <div class="detail-label">Meeting Time</div>
            <div class="detail-value">${formatDate(meeting.meeting_time)}</div>

            <div class="detail-label">Duration</div>
            <div class="detail-value">${formatDuration(meeting.meeting_duration)}</div>

            <div class="detail-label">Company</div>
            <div class="detail-value">${escapeHtml(meeting.company_name || 'Not provided')}</div>

            <div class="detail-label">Job Opportunity</div>
            <div class="detail-value">${escapeHtml(meeting.job_opportunity || 'Not provided')}</div>

            <div class="detail-label">Recruiter</div>
            <div class="detail-value">${escapeHtml(meeting.recruiter_name || 'Not provided')}</div>

            <div class="detail-label">Status</div>
            <div class="detail-value">
                <span class="status-badge ${meeting.is_active ? 'active' : 'inactive'}">
                    ${meeting.is_active ? 'Active' : 'Inactive'}
                </span>
            </div>

            <div class="detail-label">Created At</div>
            <div class="detail-value">${formatDate(meeting.created_at)}</div>

            <div class="detail-label">Updated At</div>
            <div class="detail-value">${formatDate(meeting.updated_at)}</div>
        </div>
    `;
}

function updateSettingsForm(settings) {
    state.settings = { ...state.settings, ...settings };
    elements.settingHost.value = state.settings.host;
    elements.settingPort.value = state.settings.port;
    elements.settingPath.value = state.settings.path;
    updateWebhookUrlDisplay();
}

function updateWebhookUrlDisplay() {
    const host = state.settings.host === '0.0.0.0' ? 'localhost' : state.settings.host;
    const url = `http://${host}:${state.settings.port}${state.settings.path}`;
    elements.settingsWebhookUrl.textContent = url;
    elements.webhookUrlPreview.textContent = url;
}

async function loadSettings() {
    try {
        const settings = await fetchSettings();
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);
        updateSettingsForm({
            host: settingsMap.webhook_host || '0.0.0.0',
            port: parseInt(settingsMap.webhook_port || '5687', 10),
            path: settingsMap.webhook_path || '/webhook/req-meeting',
        });
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function loadWebhookUrl() {
    try {
        const data = await fetchWebhookUrl();
        updateSettingsForm({
            host: data.host,
            port: data.port,
            path: data.path,
        });
    } catch (e) {
        console.error('Failed to load webhook URL:', e);
    }
}

// ============================================
// Action Handlers
// ============================================
let confirmCallback = null;

function handleAction(action, id) {
    const meeting = state.meetings.find(m => m.id === id);
    if (!meeting && action !== 'view') return;

    switch (action) {
        case 'view':
            if (meeting) {
                renderMeetingDetail(meeting);
                openModal(elements.detailModal);
            }
            break;

        case 'toggle':
            const newStatus = !meeting.is_active;
            showConfirm(
                `${newStatus ? 'Activate' : 'Deactivate'} Meeting`,
                `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this meeting request?`,
                () => performToggle(meeting.id, newStatus)
            );
            break;

        case 'delete':
            showConfirm(
                'Delete Meeting Request',
                'Are you sure you want to permanently delete this meeting request? This action cannot be undone.',
                () => performDelete(meeting.id)
            );
            break;

        case 'download':
            downloadMeetingJson(meeting);
            break;
    }
}

async function performToggle(id, isActive) {
    try {
        await updateMeeting(id, { is_active: isActive });
        showToast(`Meeting ${isActive ? 'activated' : 'deactivated'}`, 'success');
        fetchMeetings();
    } catch (e) {
        showToast(`Failed to update: ${e.message}`, 'error');
    }
}

async function performDelete(id) {
    try {
        await deleteMeeting(id);
        showToast('Meeting deleted', 'success');
        fetchMeetings();
    } catch (e) {
        showToast(`Failed to delete: ${e.message}`, 'error');
    }
}

function downloadMeetingJson(meeting) {
    const dataStr = JSON.stringify(meeting, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting_${meeting.id}_${meeting.user_name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Meeting downloaded', 'success');
}

async function handleExportJson() {
    try {
        const data = await exportMeetingsJson();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meetings_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Export downloaded', 'success');
    } catch (e) {
        showToast(`Export failed: ${e.message}`, 'error');
    }
}

async function handleExportCsv() {
    try {
        const blob = await exportMeetingsCsv();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meetings_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV export downloaded', 'success');
    } catch (e) {
        showToast(`Export failed: ${e.message}`, 'error');
    }
}

async function handleSaveSettings() {
    try {
        await updateSetting('webhook_host', elements.settingHost.value, 'IP address to bind webhook server');
        await updateSetting('webhook_port', elements.settingPort.value, 'Port for webhook server');
        await updateSetting('webhook_path', elements.settingPath.value, 'Webhook endpoint path');
        showToast('Settings saved. Restart required for changes to take effect.', 'success');
        loadWebhookUrl();
    } catch (e) {
        showToast(`Failed to save: ${e.message}`, 'error');
    }
}

async function handleResetSettings() {
    try {
        await initializeDefaultSettings();
        showToast('Settings reset to defaults', 'success');
        loadSettings();
    } catch (e) {
        showToast(`Failed to reset: ${e.message}`, 'error');
    }
}

// ============================================
// Modal Functions
// ============================================
function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function showConfirm(title, message, onConfirm) {
    elements.confirmTitle.textContent = title;
    elements.confirmBody.textContent = message;
    confirmCallback = onConfirm;
    openModal(elements.confirmModal);
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close" aria-label="Dismiss">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    elements.toastContainer.appendChild(toast);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideIn 0.2s ease reverse';
            setTimeout(() => toast.remove(), 200);
        }
    }, 5000);
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Sidebar toggle (top bar)
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
    });

    // Sidebar collapse toggle (sidebar header)
    if (elements.sidebarCollapseToggle) {
        elements.sidebarCollapseToggle.addEventListener('click', () => {
            elements.sidebar.classList.toggle('collapsed');
        });
    }

    // Theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);

            elements.navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Close sidebar on mobile
            if (window.innerWidth < 1024) {
                elements.sidebar.classList.remove('open');
            }
        });
    });

    // Search with debounce
    const debouncedSearch = debounce(() => {
        state.search = elements.searchInput.value.trim();
        state.page = 1;
        fetchMeetings();
    }, 300);

    elements.searchInput.addEventListener('input', debouncedSearch);

    // Filters
    elements.statusFilter.addEventListener('change', () => {
        state.statusFilter = elements.statusFilter.value;
        state.page = 1;
        fetchMeetings();
    });

    elements.sortSelect.addEventListener('change', () => {
        state.sortBy = elements.sortSelect.value;
        state.page = 1;
        fetchMeetings();
    });

    elements.pageSizeSelect.addEventListener('change', () => {
        state.pageSize = parseInt(elements.pageSizeSelect.value, 10);
        state.page = 1;
        fetchMeetings();
    });

    // Pagination
    elements.prevPage.addEventListener('click', () => {
        if (state.page > 1) {
            state.page--;
            fetchMeetings();
        }
    });

    elements.nextPage.addEventListener('click', () => {
        if (state.page < state.totalPages) {
            state.page++;
            fetchMeetings();
        }
    });

    // Refresh
    elements.refreshBtn.addEventListener('click', fetchMeetings);
    elements.refreshEmpty.addEventListener('click', fetchMeetings);

    // Export
    elements.exportJson.addEventListener('click', handleExportJson);
    elements.exportCsv.addEventListener('click', handleExportCsv);

    // Settings
    elements.saveSettings.addEventListener('click', handleSaveSettings);
    elements.resetSettings.addEventListener('click', handleResetSettings);

    // Settings form live URL update
    [elements.settingHost, elements.settingPort, elements.settingPath].forEach(el => {
        el.addEventListener('input', updateWebhookUrlDisplay);
    });

    // Copy webhook URL
    elements.copyWebhookUrl.addEventListener('click', () => copyToClipboard(elements.webhookUrlPreview.textContent));
    elements.copySettingsUrl.addEventListener('click', () => copyToClipboard(elements.settingsWebhookUrl.textContent));

    // Modals
    elements.modalClose.addEventListener('click', () => closeModal(elements.detailModal));
    elements.modalCloseBtn.addEventListener('click', () => closeModal(elements.detailModal));
    elements.modalDownload.addEventListener('click', () => {
        if (state.currentMeeting) {
            downloadMeetingJson(state.currentMeeting);
        }
    });

    elements.confirmCancel.addEventListener('click', () => closeModal(elements.confirmModal));
    elements.confirmOk.addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
        closeModal(elements.confirmModal);
    });

    // Close modals on overlay click
    [elements.detailModal, elements.confirmModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(elements.detailModal);
            closeModal(elements.confirmModal);
        }
        if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            elements.searchInput.focus();
        }
    });

    // Table header sorting
    document.querySelectorAll('.meetings-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            const currentSort = state.sortBy;
            let newSort;

            if (currentSort.startsWith(sortKey + ':asc')) {
                newSort = `${sortKey}:desc`;
            } else {
                newSort = `${sortKey}:asc`;
            }

            state.sortBy = newSort;
            state.page = 1;
            fetchMeetings();

            // Update sort indicators
            document.querySelectorAll('.meetings-table th').forEach(h => {
                h.classList.remove('sorted-asc', 'sorted-desc');
            });
            th.classList.add(newSort.endsWith('asc') ? 'sorted-asc' : 'sorted-desc');
        });
    });
}

function switchPage(pageName) {
    elements.pages.forEach(page => {
        page.classList.toggle('active', page.id === `page-${pageName}`);
    });

    const titles = {
        dashboard: 'Dashboard',
        settings: 'Settings',
    };
    elements.pageTitle.textContent = titles[pageName] || 'Dashboard';

    // Load page-specific data
    if (pageName === 'settings') {
        loadSettings();
    } else if (pageName === 'dashboard') {
        fetchMeetings();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy', 'error');
    });
}

// ============================================
// Initialization
// ============================================
async function init() {
    console.log('Initializing Meeting Request Dashboard...');

    // Initialize theme before setting up event listeners
    initTheme();
    setupEventListeners();
    connectWebSocket();

    // Load initial data
    await Promise.all([
        fetchMeetings(),
        loadWebhookUrl(),
    ]);

    // Load app info
    elements.appVersion.textContent = '1.0.0';
    elements.appEnv.textContent = 'production';
    elements.appDb.textContent = 'MySQL';

    console.log('Dashboard initialized successfully');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}