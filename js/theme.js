// ============================================
// THEME MANAGEMENT - FIXED
// ============================================

// Get preferred theme
function getPreferredTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        return savedTheme;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

// Apply theme
function applyTheme(theme) {
    // Set data attribute
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update toggle buttons
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) {
        darkToggle.checked = theme === 'dark';
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = theme === 'dark' ? '#0a0a1a' : '#f8f4ff';
    }

    // Update body background
    document.body.style.transition = 'background 0.5s ease, color 0.5s ease';
    
    // Trigger reflow for smooth transition
    void document.body.offsetHeight;

    console.log(`🎨 Theme applied: ${theme}`);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    
    // Show notification
    showToast(`Mode ${newTheme === 'dark' ? 'Gelap' : 'Terang'} diaktifkan 🌓`, 'info', 1500);
    
    return newTheme;
}

// Listen for system theme changes
function listenSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
        // Only apply if user hasn't manually set a preference
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    };
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
    } 
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange);
    }
}

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
    const theme = getPreferredTheme();
    applyTheme(theme);
    listenSystemTheme();

    // Setup dark mode toggle in settings
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (darkToggle) {
        darkToggle.checked = theme === 'dark';
        darkToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            applyTheme(newTheme);
            showToast(`Mode ${newTheme === 'dark' ? 'Gelap' : 'Terang'} diaktifkan 🌓`, 'info', 1500);
        });
    }

    // Setup theme toggle button (usually in header)
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
});

// Export functions
window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.getPreferredTheme = getPreferredTheme;

console.log('✅ Theme module loaded');
