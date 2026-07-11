// Utility functions

// Check if user is on mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if user is on iOS
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Check if user is on Android
function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

// Get device type
function getDeviceType() {
    if (isMobile()) {
        if (isIOS()) return 'ios';
        if (isAndroid()) return 'android';
        return 'mobile';
    }
    return 'desktop';
}

// Copy to clipboard
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

// Share via Web Share API
function shareData(data) {
    if (navigator.share) {
        return navigator.share(data);
    }
    return Promise.reject(new Error('Web Share API not supported'));
}

// Get query parameter from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Set query parameter in URL without reload
function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.replaceState({}, '', url);
}

// Remove query parameter from URL
function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.replaceState({}, '', url);
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number (Indonesia)
function isValidPhone(phone) {
    const re = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    return re.test(phone);
}

// Format phone number
function formatPhone(phone) {
    // Remove non-numeric
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('62')) {
        return '+' + cleaned;
    }
    if (cleaned.startsWith('0')) {
        return '+62' + cleaned.slice(1);
    }
    return phone;
}

// Get time ago string
function timeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
}

// Format number with suffix (K, M, B)
function formatNumberWithSuffix(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
}

// Generate random color
function randomColor() {
    const colors = [
        '#ff6b9d', '#c44dff', '#ffd700', '#34c759',
        '#007aff', '#ff9500', '#ff3b30', '#5856d6',
        '#ff2d92', '#64d2ff', '#ffb900', '#30d158'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Get emoji for mood
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

// Get love language emoji
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

// Get relationship stage
function getRelationshipStage(days) {
    if (days < 30) return '🌱 Newly Together';
    if (days < 90) return '🌷 Growing Love';
    if (days < 180) return '🌸 Deepening Connection';
    if (days < 365) return '🌺 Strong Bond';
    if (days < 730) return '🌹 True Love';
    if (days < 1095) return '💖 Soulmates';
    return '💫 Eternal Love';
}

// Export utility functions
window.isMobile = isMobile;
window.isIOS = isIOS;
window.isAndroid = isAndroid;
window.getDeviceType = getDeviceType;
window.copyToClipboard = copyToClipboard;
window.shareData = shareData;
window.getQueryParam = getQueryParam;
window.setQueryParam = setQueryParam;
window.removeQueryParam = removeQueryParam;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.formatPhone = formatPhone;
window.timeAgo = timeAgo;
window.formatNumberWithSuffix = formatNumberWithSuffix;
window.randomColor = randomColor;
window.getMoodEmoji = getMoodEmoji;
window.getLoveLanguageEmoji = getLoveLanguageEmoji;
window.getRelationshipStage = getRelationshipStage;
