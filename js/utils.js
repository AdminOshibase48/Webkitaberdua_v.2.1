// ============================================
// UTILITY FUNCTIONS
// ============================================

// ============================================
// CLIPBOARD & SHARING
// ============================================

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }

    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return Promise.resolve();
}

function shareData(data) {
    if (navigator.share) {
        return navigator.share(data);
    }
    return Promise.reject(new Error('Web Share API not supported'));
}

// ============================================
// URL HELPERS
// ============================================

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.replaceState({}, '', url);
}

function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.replaceState({}, '', url);
}

// ============================================
// NUMBER FORMATTING
// ============================================

function formatNumberWithSuffix(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}

function randomColor() {
    const colors = [
        '#ff6b9d', '#c44dff', '#ffd700', '#34c759',
        '#007aff', '#ff9500', '#ff3b30', '#5856d6',
        '#ff2d92', '#64d2ff', '#ffb900', '#30d158'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================
// EMOJI HELPERS
// ============================================

function getMoodEmoji(mood) {
    const moods = {
        'happy': '😊',
        'sad': '😢',
        'angry': '😡',
        'love': '❤️',
        'excited': '🤩',
        'tired': '😴',
        'stressed': '😰',
        'calm': '😌',
        'grateful': '🙏',
        'hopeful': '🌟'
    };
    return moods[mood] || '💕';
}

function getLoveLanguageEmoji(language) {
    const languages = {
        'words': '💬',
        'acts': '💪',
        'gifts': '🎁',
        'time': '⏰',
        'touch': '🤗'
    };
    return languages[language] || '💕';
}

function getRelationshipStage(days) {
    if (days < 30) return '🌱 Baru Bersama';
    if (days < 90) return '🌷 Tumbuh Cinta';
    if (days < 180) return '🌸 Hubungan Mendalam';
    if (days < 365) return '🌺 Ikatan Kuat';
    if (days < 730) return '🌹 Cinta Sejati';
    if (days < 1095) return '💖 Jodoh';
    return '💫 Cinta Abadi';
}

// ============================================
// STRING HELPERS
// ============================================

function capitalizeFirst(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

function randomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============================================
// EXPORTS
// ============================================

window.copyToClipboard = copyToClipboard;
window.shareData = shareData;
window.getQueryParam = getQueryParam;
window.setQueryParam = setQueryParam;
window.removeQueryParam = removeQueryParam;
window.formatNumberWithSuffix = formatNumberWithSuffix;
window.randomColor = randomColor;
window.getMoodEmoji = getMoodEmoji;
window.getLoveLanguageEmoji = getLoveLanguageEmoji;
window.getRelationshipStage = getRelationshipStage;
window.capitalizeFirst = capitalizeFirst;
window.slugify = slugify;
window.randomString = randomString;

console.log('✅ Utils module loaded');
