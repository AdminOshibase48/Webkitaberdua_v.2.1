// UI Utilities

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto hide
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, duration);
}

// Format currency (IDR)
function formatCurrency(amount) {
    return `Rp ${parseFloat(amount).toLocaleString()}`;
}

// Format date
function formatDate(date, format = 'short') {
    const d = new Date(date);
    if (format === 'short') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } else if (format === 'long') {
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } else if (format === 'relative') {
        const now = new Date();
        const diff = now - d;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    }
    return d.toLocaleDateString();
}

// Truncate text
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

// Generate random id
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Debounce function
function debounce(func, wait = 300) {
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

// Throttle function
function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

// Add confetti celebration
function showConfetti(count = 50) {
    const colors = ['#ff6b9d', '#c44dff', '#ffd700', '#34c759', '#007aff', '#ff9500'];

    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = Math.random() * 8 + 4 + 'px';
        confetti.style.height = Math.random() * 8 + 4 + 'px';
        confetti.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
        confetti.style.setProperty('--ty', Math.random() * 500 + 200 + 'px');
        confetti.style.animationDuration = Math.random() * 2 + 1 + 's';
        confetti.style.animationDelay = Math.random() * 0.5 + 's';

        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, 3000);
    }
}

// Show love reaction
function showLoveReaction(x, y) {
    const emojis = ['❤️', '💕', '💗', '💖', '💘', '💝', '✨', '🌟'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    const el = document.createElement('div');
    el.className = 'love-reaction';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    document.body.appendChild(el);

    setTimeout(() => {
        el.remove();
    }, 1000);
}

// Add particle effect
function createParticles(count = 20) {
    const colors = ['#ff6b9d', '#c44dff', '#ffd700', '#34c759'];

    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.bottom = '-10px';
        particle.style.width = Math.random() * 6 + 3 + 'px';
        particle.style.height = Math.random() * 6 + 3 + 'px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDuration = Math.random() * 3 + 2 + 's';
        particle.style.animationDelay = Math.random() * 2 + 's';

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 5000);
    }
}

// Add XP notification
function showXPNotification(amount) {
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `✨ +${amount} XP earned!`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 2000);
}

// Add level up notification
function showLevelUpNotification(level) {
    showToast(`🎉 Level Up! You're now level ${level}!`, 'success', 4000);
    showConfetti(80);
}

// Update relationship counter
async function updateRelationshipCounter() {
    const relationship = await getRelationship();
    if (!relationship) return;

    const startDate = new Date(relationship.start_date);
    const now = new Date();
    const diffTime = Math.abs(now - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const elements = document.querySelectorAll('.together-days');
    elements.forEach(el => {
        el.textContent = `${diffDays} days`;
    });

    return diffDays;
}

// Update XP display
async function updateXPDisplay() {
    const user = await getCurrentUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from('user_stats')
        .select('xp, level')
        .eq('user_id', user.id)
        .single();

    if (error) {
        // Create stats if not exists
        await supabaseClient
            .from('user_stats')
            .insert({
                user_id: user.id,
                xp: 0,
                level: 1
            });
        return;
    }

    const xpElements = document.querySelectorAll('.user-xp');
    xpElements.forEach(el => {
        el.textContent = `${data.xp} XP`;
    });

    const levelElements = document.querySelectorAll('.user-level');
    levelElements.forEach(el => {
        el.textContent = `Level ${data.level}`;
    });

    return data;
}

// Add XP
async function addXP(amount) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        // Get current stats
        const { data: stats, error: statsError } = await supabaseClient
            .from('user_stats')
            .select('xp, level')
            .eq('user_id', user.id)
            .single();

        if (statsError) {
            // Create stats
            await supabaseClient
                .from('user_stats')
                .insert({
                    user_id: user.id,
                    xp: amount,
                    level: 1
                });
            showXPNotification(amount);
            return;
        }

        const newXP = stats.xp + amount;
        const xpPerLevel = 100;
        let newLevel = stats.level;

        if (newXP >= xpPerLevel * stats.level) {
            newLevel = stats.level + 1;
            showLevelUpNotification(newLevel);
            showConfetti(60);
        }

        // Update stats
        await supabaseClient
            .from('user_stats')
            .update({
                xp: newXP,
                level: newLevel
            })
            .eq('user_id', user.id);

        showXPNotification(amount);
        updateXPDisplay();

        return { xp: newXP, level: newLevel };
    } catch (error) {
        console.error('Add XP error:', error);
    }
}

// Load daily quote
async function loadDailyQuote() {
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
        "Love is the only force capable of transforming an enemy into a friend. 🤝",
        "Where there is love, there is life. 🌿"
    ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    quoteElement.textContent = quote;
}

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
    // Load daily quote
    await loadDailyQuote();

    // Update relationship counter
    await updateRelationshipCounter();

    // Update XP display
    await updateXPDisplay();

    // Refresh button for quote
    const refreshBtn = document.getElementById('refresh-quote');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDailyQuote);
    }

    // Theme toggle on dashboard
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

    // Quick action buttons on dashboard
    document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const routes = {
                'chat': '/chat.html',
                'memory': '/memories.html',
                'finance': '/finance.html',
                'calendar': '/calendar.html',
                'ai': '/settings.html'
            };
            if (routes[action]) {
                window.location.href = routes[action];
            }
        });
    });

    // Mobile menu toggle
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav) {
                nav.classList.toggle('open');
            }
        });
    }

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const nav = document.querySelector('.nav-links');
            if (nav) {
                nav.classList.remove('open');
            }
        });
    });
});

// Export UI functions
window.showToast = showToast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.truncateText = truncateText;
window.generateId = generateId;
window.debounce = debounce;
window.throttle = throttle;
window.showConfetti = showConfetti;
window.showLoveReaction = showLoveReaction;
window.createParticles = createParticles;
window.showXPNotification = showXPNotification;
window.addXP = addXP;
window.updateXPDisplay = updateXPDisplay;
window.updateRelationshipCounter = updateRelationshipCounter;
window.loadDailyQuote = loadDailyQuote;
