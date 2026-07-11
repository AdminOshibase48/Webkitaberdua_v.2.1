// Notification system
let notificationChannel = null;
let unreadCount = 0;
let notificationPermission = false;

// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return false;
    }

    const permission = await Notification.requestPermission();
    notificationPermission = permission === 'granted';
    return notificationPermission;
}

// Send browser notification
function sendBrowserNotification(title, body, icon = '/favicon.ico') {
    if (!notificationPermission) return;

    try {
        const notification = new Notification(title, {
            body: body,
            icon: icon,
            badge: '/favicon.ico',
            vibrate: [200, 100, 200],
            tag: Date.now()
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    } catch (error) {
        console.error('Notification error:', error);
    }
}

// Add notification to database
async function addNotification(userId, type, title, message, data = null) {
    try {
        const notification = {
            user_id: userId,
            type: type,
            title: title,
            message: message,
            data: data,
            read: false
        };

        const { data: result, error } = await supabaseClient
            .from('notifications')
            .insert(notification)
            .select()
            .single();

        if (error) throw error;

        // Send realtime notification
        if (notificationChannel) {
            notificationChannel.send({
                type: 'broadcast',
                event: 'new_notification',
                payload: result
            });
        }

        // Send browser notification
        if (notificationPermission) {
            sendBrowserNotification(title, message);
        }

        return result;
    } catch (error) {
        console.error('Add notification error:', error);
        return null;
    }
}

// Get user notifications
async function getNotifications(limit = 50) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get notifications error:', error);
        return [];
    }
}

// Mark notification as read
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Mark notification as read error:', error);
        return false;
    }
}

// Mark all notifications as read
async function markAllNotificationsAsRead() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const { error } = await supabaseClient
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id);

        if (error) throw error;
        unreadCount = 0;
        updateNotificationBadge();
        return true;
    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        return false;
    }
}

// Subscribe to realtime notifications
function subscribeToNotifications(callback) {
    try {
        notificationChannel = supabaseClient
            .channel('notifications')
            .on('broadcast', { event: 'new_notification' }, (payload) => {
                callback(payload.payload);
            })
            .subscribe();

        return notificationChannel;
    } catch (error) {
        console.error('Subscribe to notifications error:', error);
        return null;
    }
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Update favicon badge (if supported)
    if ('setAppBadge' in navigator && unreadCount > 0) {
        navigator.setAppBadge(unreadCount);
    } else if ('setAppBadge' in navigator) {
        navigator.clearAppBadge();
    }
}

// Load notifications into UI
async function loadNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    const notifications = await getNotifications(20);
    unreadCount = notifications.filter(n => !n.read).length;

    if (notifications.length === 0) {
        container.innerHTML = '<p class="empty-state">No notifications yet</p>';
        return;
    }

    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
            <div class="notification-icon">${getNotificationIcon(n.type)}</div>
            <div class="notification-content">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${timeAgo(n.created_at)}</div>
            </div>
            ${!n.read ? '<button class="mark-read-btn">✓</button>' : ''}
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            await markNotificationAsRead(id);
            item.classList.remove('unread');
            item.classList.add('read');
            const btn = item.querySelector('.mark-read-btn');
            if (btn) btn.remove();
            unreadCount--;
            updateNotificationBadge();
        });
    });

    updateNotificationBadge();
}

// Get notification icon by type
function getNotificationIcon(type) {
    const icons = {
        'message': '💬',
        'anniversary': '🎉',
        'finance': '💰',
        'memory': '📸',
        'reminder': '⏰',
        'achievement': '🏆',
        'ai': '🤖'
    };
    return icons[type] || '📢';
}

// Initialize notifications
document.addEventListener('DOMContentLoaded', async () => {
    // Request permission
    await requestNotificationPermission();

    // Load notifications
    await loadNotifications();

    // Subscribe to new notifications
    subscribeToNotifications((notification) => {
        // Add to UI
        const container = document.getElementById('notifications-list');
        if (!container) return;

        const item = document.createElement('div');
        item.className = 'notification-item unread';
        item.dataset.id = notification.id;
        item.innerHTML = `
            <div class="notification-icon">${getNotificationIcon(notification.type)}</div>
            <div class="notification-content">
                <div class="notification-title">${notification.title}</div>
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">just now</div>
            </div>
            <button class="mark-read-btn">✓</button>
        `;

        container.insertBefore(item, container.firstChild);
        unreadCount++;
        updateNotificationBadge();

        // Send browser notification
        sendBrowserNotification(notification.title, notification.message);

        // Show toast
        showToast(`${notification.title}: ${notification.message}`, 'info');
    });

    // Notification button
    const notifyBtn = document.getElementById('notifications-btn');
    if (notifyBtn) {
        notifyBtn.addEventListener('click', () => {
            // Toggle notification panel or navigate
            window.location.href = '/notifications.html';
        });
    }

    // Mark all as read button
    const markAllBtn = document.getElementById('mark-all-read');
    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            await markAllNotificationsAsRead();
            loadNotifications();
            showToast('All notifications marked as read', 'success');
        });
    }
});

// Export functions
window.addNotification = addNotification;
window.getNotifications = getNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.loadNotifications = loadNotifications;
window.requestNotificationPermission = requestNotificationPermission;
