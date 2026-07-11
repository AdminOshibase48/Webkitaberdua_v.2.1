// ============================================
// UI UTILITIES
// ============================================

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ============================================
// FORMAT HELPERS
// ============================================

function formatCurrency(amount) {
    return `Rp ${parseFloat(amount).toLocaleString('id-ID')}`;
}

function formatDate(date, format = 'short') {
    const d = new Date(date);
    if (format === 'short') {
        return d.toLocaleDateString('id-ID', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    } else if (format === 'long') {
        return d.toLocaleDateString('id-ID', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    } else if (format === 'relative') {
        return timeAgo(date);
    }
    return d.toLocaleDateString('id-ID');
}

function timeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'baru saja';
    if (minutes < 60) return `${minutes}m lalu`;
    if (hours < 24) return `${hours}j lalu`;
    if (days < 30) return `${days}h lalu`;
    if (days < 365) return `${Math.floor(days / 30)}bl lalu`;
    return `${Math.floor(days / 365)}th lalu`;
}

function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// ============================================
// VALIDATION
// ============================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(phone);
}

// ============================================
// ANIMATIONS & EFFECTS
// ============================================

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
        confetti.style.setProperty('--duration', Math.random() * 2 + 1 + 's');

        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 3000);
    }
}

function showLoveReaction(x, y) {
    const emojis = ['❤️', '💕', '💗', '💖', '💘', '💝', '✨', '🌟'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    const el = document.createElement('div');
    el.className = 'love-reaction';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function showXPNotification(amount) {
    showToast(`✨ +${amount} XP earned!`, 'success', 2000);
}

function showLevelUpNotification(level) {
    showToast(`🎉 Level Up! You're now level ${level}!`, 'success', 4000);
    showConfetti(80);
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

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

// ============================================
// RELATIONSHIP & XP UPDATES
// ============================================

async function updateRelationshipCounter() {
    const relationship = await getRelationship();
    if (!relationship) return 0;

    const startDate = new Date(relationship.start_date);
    const now = new Date();
    const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    document.querySelectorAll('.together-days').forEach(el => {
        el.textContent = `${diffDays} days`;
    });

    return diffDays;
}

async function updateXPDisplay() {
    try {
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

        document.querySelectorAll('.user-xp').forEach(el => {
            el.textContent = `${data.xp} XP`;
        });

        document.querySelectorAll('.user-level').forEach(el => {
            el.textContent = `Level ${data.level}`;
        });

        return data;
    } catch (error) {
        console.error('Update XP error:', error);
    }
}

async function addXP(amount) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const { data: stats, error: statsError } = await supabaseClient
            .from('user_stats')
            .select('xp, level')
            .eq('user_id', user.id)
            .single();

        if (statsError) {
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

// ============================================
// DAILY QUOTE
// ============================================

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
        "Where there is love, there is life. 🌿",
        "The greatest happiness of life is the conviction that we are loved. 💖",
        "Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its target full of hope. 🌟",
        "To love and be loved is to feel the sun from both sides. ☀️",
        "The best love is the kind that awakens the soul. 🌸"
    ];

    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    quoteElement.textContent = quote;
}

// ============================================
// DEVICE HELPERS
// ============================================

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

function getDeviceType() {
    if (isMobile()) {
        if (isIOS()) return 'ios';
        if (isAndroid()) return 'android';
        return 'mobile';
    }
    return 'desktop';
}

// ============================================
// EXPORTS
// ============================================

window.showToast = showToast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.timeAgo = timeAgo;
window.truncateText = truncateText;
window.generateId = generateId;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.showConfetti = showConfetti;
window.showLoveReaction = showLoveReaction;
window.showXPNotification = showXPNotification;
window.showLevelUpNotification = showLevelUpNotification;
window.debounce = debounce;
window.throttle = throttle;
window.updateRelationshipCounter = updateRelationshipCounter;
window.updateXPDisplay = updateXPDisplay;
window.addXP = addXP;
window.loadDailyQuote = loadDailyQuote;
window.isMobile = isMobile;
window.isIOS = isIOS;
window.isAndroid = isAndroid;
window.getDeviceType = getDeviceType;

console.log('✅ UI module loaded');
