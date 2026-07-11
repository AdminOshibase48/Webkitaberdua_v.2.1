// ============================================
// MAIN APPLICATION
// ============================================

// Init app
window.initApp = async function() {
    console.log('💕 OurStory Together - Starting up...');

    const user = await window.getCurrentUser();
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    // Auth pages - redirect if logged in
    const authPages = ['login.html', 'register.html', 'index.html'];
    if (user && authPages.includes(currentPath)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Protected pages - redirect if not logged in
    const protectedPages = ['dashboard.html', 'chat.html', 'finance.html', 'memories.html', 'calendar.html', 'settings.html', 'ai.html'];
    if (!user && protectedPages.includes(currentPath)) {
        window.location.href = 'login.html';
        return;
    }

    // Load user data
    if (user) {
        window.currentUser = user;
        window.currentUserProfile = await window.getUserProfile();
        window.partnerProfile = await window.getPartnerProfile();
        window.relationshipData = await window.getRelationship();

        await window.updatePresence('online');
        window.updateUIWithUserData();
        window.updateRelationshipCounter();
        window.updateXPDisplay();

        // Partner presence subscription
        if (window.currentUserProfile?.partner_id) {
            window.subscribeToPresence(window.currentUserProfile.partner_id, (profile) => {
                document.querySelectorAll('.partner-status').forEach(el => {
                    if (el) {
                        el.textContent = profile.status === 'online' ? 'Online' : 'Offline';
                        el.className = `partner-status ${profile.status}`;
                    }
                });
            });
        }
    }

    // Setup quick actions
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

    // Set active nav
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPath) {
            item.classList.add('active');
        }
    });

    console.log('✅ App ready!');
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    // Page enter animation
    document.body.classList.add('page-enter');

    // Back buttons
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'dashboard.html';
            }
        });
    });

    // Init app
    window.initApp();
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window.updatePresence('away');
    } else {
        window.updatePresence('online');
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    window.updatePresence('offline');
});

// Error handling
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    window.showToast('Something went wrong. Please try again.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
});

console.log('✅ App module loaded');
