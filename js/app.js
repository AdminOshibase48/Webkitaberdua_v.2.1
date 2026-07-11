// ============================================
// MAIN APPLICATION - app.js
// ============================================

// Initialize app
async function initApp() {
    console.log('💕 OurStory Together - Starting up...');

    try {
        // Check authentication
        const user = await getCurrentUser();

        // Get current page
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        // Auth pages
        const authPages = ['login.html', 'register.html'];
        
        // Protected pages
        const protectedPages = [
            'dashboard.html', 'chat.html', 'finance.html', 
            'memories.html', 'calendar.html', 'settings.html', 'ai.html'
        ];

        // Redirect logic
        if (user && authPages.includes(currentPath)) {
            window.location.href = 'dashboard.html';
            return;
        }

        if (!user && protectedPages.includes(currentPath)) {
            window.location.href = 'login.html';
            return;
        }

        // Load user data if logged in
        if (user) {
            currentUser = user;
            currentUserProfile = await getUserProfile();
            await getPartnerProfile();
            await getRelationship();

            // Update presence
            await updatePresence('online');

            // Set up presence subscription
            if (currentUserProfile?.partner_id) {
                subscribeToPresence(currentUserProfile.partner_id, (profile) => {
                    updatePartnerStatusUI(profile);
                });
            }

            // Update UI with user data
            updateUIWithUserData();
        }

        // Setup UI
        setupUI();

        // Setup quick actions
        setupQuickActions();

        // Setup theme
        setupTheme();

        console.log('✅ OurStory Together - Ready!');

    } catch (error) {
        console.error('❌ App initialization error:', error);
        showToast('Error loading app. Please refresh.', 'error');
    }
}

// ============================================
// SETUP UI
// ============================================

function setupUI() {
    // Load daily quote
    loadDailyQuote();

    // Update relationship counter
    updateRelationshipCounter();

    // Update XP display
    updateXPDisplay();

    // Setup back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    });

    // Setup mobile menu
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav) nav.classList.toggle('open');
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav) nav.classList.remove('open');
        });
    });
}

// ============================================
// SETUP QUICK ACTIONS
// ============================================

function setupQuickActions() {
    document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const routes = {
                'chat': 'chat.html',
                'memory': 'memories.html',
                'finance': 'finance.html',
                'calendar': 'calendar.html',
                'ai': 'ai.html',
                'settings': 'settings.html'
            };
            if (routes[action]) {
                window.location.href = routes[action];
            }
        });
    });

    // Setup bottom navigation active state
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ============================================
// SETUP THEME
// ============================================

function setupTheme() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }

    // Dark mode toggle in settings
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            applyTheme(theme);
        });
    }
}

// ============================================
// UPDATE UI FUNCTIONS
// ============================================

function updateUIWithUserData() {
    if (!currentUser) return;

    // Update user name
    document.querySelectorAll('#user-name, .user-name').forEach(el => {
        el.textContent = currentUserProfile?.full_name || currentUser.email;
    });

    // Update user email
    document.querySelectorAll('#user-email').forEach(el => {
        el.textContent = currentUser.email;
    });

    // Update partner name
    if (partnerProfile) {
        document.querySelectorAll('#partner-name, .partner-name').forEach(el => {
            el.textContent = partnerProfile.full_name;
        });
    }

    // Update relationship data
    if (relationshipData) {
        const startDate = new Date(relationshipData.start_date);
        const now = new Date();
        const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

        document.querySelectorAll('#together-days, .together-days').forEach(el => {
            el.textContent = `${diffDays} days`;
        });

        const statusEl = document.querySelector('#relationship-status');
        if (statusEl) {
            statusEl.textContent = `Together since ${startDate.toLocaleDateString()}`;
        }
    }
}

function updatePartnerStatusUI(profile) {
    if (!profile) return;

    document.querySelectorAll('.partner-status').forEach(el => {
        if (profile.status === 'online') {
            el.textContent = 'Online';
            el.className = 'partner-status online';
        } else {
            el.textContent = 'Offline';
            el.className = 'partner-status offline';
        }
    });

    document.querySelectorAll('.partner
