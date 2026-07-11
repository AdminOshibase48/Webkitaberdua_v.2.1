// Theme management

// Get saved theme or system preference
function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

// Apply theme
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update toggle button if exists
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
        toggle.checked = theme === 'dark';
    }

    // Update theme button if exists
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = theme === 'dark' ? '#0a0a1a' : '#f5f0ff';
    }
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    return newTheme;
}

// Listen for system theme changes
function listenSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
    const theme = getPreferredTheme();
    applyTheme(theme);

    // Setup dark mode toggle
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) {
        toggle.checked = theme === 'dark';
        toggle.addEventListener('change', (e) => {
            applyTheme(e.target.checked ? 'dark' : 'light');
        });
    }

    // Setup theme toggle button
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Listen for system changes
    listenSystemTheme();
});

// Export functions
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.getPreferredTheme = getPreferredTheme;
