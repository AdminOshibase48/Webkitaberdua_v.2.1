// ============================================
// UI FUNCTIONS
// ============================================

// Update relationship counter
window.updateRelationshipCounter = async function() {
    const relationship = await window.getRelationship();
    if (!relationship) return 0;

    const startDate = new Date(relationship.start_date);
    const now = new Date();
    const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    document.querySelectorAll('.together-days, #together-days').forEach(el => {
        if (el) el.textContent = `${diffDays} days`;
    });

    return diffDays;
};

// Update XP display
window.updateXPDisplay = async function() {
    const user = await window.getCurrentUser();
    if (!user) return;

    const { data, error } = await window.supabaseClient
        .from('user_stats')
        .select('xp, level')
        .eq('user_id', user.id)
        .single();

    if (error) {
        // Create stats if not exists
        await window.supabaseClient
            .from('user_stats')
            .insert({
                user_id: user.id,
                xp: 0,
                level: 1
            });
        return { xp: 0, level: 1 };
    }

    document.querySelectorAll('.user-xp, #user-xp').forEach(el => {
        if (el) el.textContent = `${data.xp} XP`;
    });

    document.querySelectorAll('.user-level, #love-level').forEach(el => {
        if (el) el.textContent = `Lv. ${data.level}`;
    });

    return data;
};

// Load daily quote
window.loadDailyQuote = function() {
    const quoteElement = document.getElementById('daily-quote');
    if (!quoteElement) return;

    const quotes = [
        "Love is the bridge between two hearts. 🌉",
        "Every day with you is my favorite day. 💕",
        "Together is a beautiful place to be. 🌈",
        "Your love is the greatest gift. 🎁",
        "Love doesn't make the world go round; it makes the ride worthwhile. 🎢",
        "The best thing to hold onto in life is each other. 🤝",
        "Love is not about how many days together, but how much you love each other every day. 💗",
        "You are my today and all of my tomorrows. 🌅",
        "Where there is love, there is life. 🌿",
        "Love is the only force capable of transforming an enemy into a friend. ✨"
    ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    quoteElement.textContent = quote;
};

// Update UI with user data
window.updateUIWithUserData = function() {
    if (!window.currentUser) return;

    // User name
    document.querySelectorAll('#user-name, .user-name').forEach(el => {
        if (el) el.textContent = window.currentUserProfile?.full_name || window.currentUser.email;
    });

    // User email
    document.querySelectorAll('#user-email').forEach(el => {
        if (el) el.textContent = window.currentUser.email;
    });

    // Partner name
    if (window.partnerProfile) {
        document.querySelectorAll('#partner-name, .partner-name').forEach(el => {
            if (el) el.textContent = window.partnerProfile.full_name;
        });
    }

    // Relationship status
    const statusEl = document.querySelector('#relationship-status');
    if (statusEl && window.relationshipData) {
        const startDate = new Date(window.relationshipData.start_date);
        statusEl.textContent = `Together since ${startDate.toLocaleDateString()}`;
    }
};

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    // Load daily quote
    window.loadDailyQuote();

    // Refresh quote button
    const refreshBtn = document.getElementById('refresh-quote');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadDailyQuote);
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }

    // Update relationship counter
    await window.updateRelationshipCounter();

    // Update XP display
    await window.updateXPDisplay();

    console.log('✅ UI initialized');
});

console.log('✅ UI module loaded');
