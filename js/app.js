// ============================================
// MAIN APPLICATION - app.js
// ============================================

// Initialize app
async function initApp() {
    console.log('💕 OurStory Together - Starting up...');

    // Check authentication
    const user = await getCurrentUser();

    // If on auth pages and already logged in, redirect to dashboard
    const authPages = ['login.html', 'register.html'];
    const currentPath = window.location.pathname.split('/').pop();

    if (user && authPages.includes(currentPath)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // If on protected pages and not logged in, redirect to login
    const protectedPages = ['dashboard.html', 'chat.html', 'finance.html', 'memories.html', 'calendar.html', 'settings.html', 'ai.html'];
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
                // Update partner status in UI
                const statusElements = document.querySelectorAll('.partner-status');
                statusElements.forEach(el => {
                    if (profile.status === 'online') {
                        el.textContent = 'Online';
                        el.className = 'partner-status online';
                    } else {
                        el.textContent = 'Offline';
                        el.className = 'partner-status offline';
                    }
                });

                // Update last seen
                const lastSeenElements = document.querySelectorAll('.partner-last-seen');
                lastSeenElements.forEach(el => {
                    if (profile.last_seen) {
                        el.textContent = timeAgo(profile.last_seen);
                    }
                });
            });
        }

        // Load user data into UI
        updateUIWithUserData();
    }

    // Register service worker
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Setup quick action handlers
    setupQuickActions();

    console.log('💕 OurStory Together - Ready!');
}

// Setup quick action buttons
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

// Update UI with user data
function updateUIWithUserData() {
    if (!currentUser) return;

    // Update user name
    const nameElements = document.querySelectorAll('#user-name, .user-name');
    nameElements.forEach(el => {
        el.textContent = currentUserProfile?.full_name || currentUser.email;
    });

    // Update user email
    const emailElements = document.querySelectorAll('#user-email');
    emailElements.forEach(el => {
        el.textContent = currentUser.email;
    });

    // Update partner name
    if (partnerProfile) {
        const partnerNameElements = document.querySelectorAll('#partner-name, .partner-name');
        partnerNameElements.forEach(el => {
            el.textContent = partnerProfile.full_name;
        });
    }

    // Update relationship data
    if (relationshipData) {
        const startDate = new Date(relationshipData.start_date);
        const now = new Date();
        const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

        const togetherElements = document.querySelectorAll('#together-days, .together-days');
        togetherElements.forEach(el => {
            el.textContent = `${diffDays} days`;
        });

        const relationshipStatus = document.querySelector('#relationship-status');
        if (relationshipStatus) {
            relationshipStatus.textContent = `Together since ${startDate.toLocaleDateString()}`;
        }
    }

    // Update partner status
    const status = currentUserProfile?.status || 'online';
    const statusElements = document.querySelectorAll('.user-status');
    statusElements.forEach(el => {
        el.textContent = status;
        el.className = `user-status ${status}`;
    });
}

// Handle online/offline status
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        updatePresence('away');
    } else {
        updatePresence('online');
    }
});

// Handle before unload
window.addEventListener('beforeunload', () => {
    updatePresence('offline');
});

// Handle navigation
document.addEventListener('DOMContentLoaded', () => {
    // Add page enter animation
    document.body.classList.add('page-enter');

    // Handle back button
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    });

    // Init app
    initApp();
});

// Handle errors
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    showToast('Something went wrong. Please try again.', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
});

// Export app
window.initApp = initApp;
window.setupQuickActions = setupQuickActions;
