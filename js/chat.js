// ============================================
// CHAT MODULE
// ============================================

let chatChannel = null;
let currentMessages = [];
let typingTimeout = null;

// ============================================
// SEND MESSAGE
// ============================================

async function sendMessage(content, type = 'text', metadata = {}) {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const message = {
            sender_id: user.id,
            content: content,
            type: type,
            metadata: metadata,
            status: 'sent'
        };

        const { data, error } = await supabaseClient
            .from('messages')
            .insert(message)
            .select()
            .single();

        if (error) throw error;

        // Add XP for sending messages
        await addXP(2);

        return data;
    } catch (error) {
        console.error('Send message error:', error);
        showToast('Gagal mengirim pesan', 'error');
        return null;
    }
}

// ============================================
// GET MESSAGES
// ============================================

async function getMessages(limit = 50) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        currentMessages = data.reverse();
        return currentMessages;
    } catch (error) {
        console.error('Get messages error:', error);
        return [];
    }
}

// ============================================
// SUBSCRIBE TO MESSAGES
// ============================================

function subscribeToMessages(callback) {
    try {
        if (chatChannel) {
            chatChannel.unsubscribe();
        }

        chatChannel = supabaseClient
            .channel('messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        return chatChannel;
    } catch (error) {
        console.error('Subscribe to messages error:', error);
        return null;
    }
}

// ============================================
// TYPING INDICATOR
// ============================================

async function sendTypingIndicator() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        await supabaseClient
            .from('profiles')
            .update({ is_typing: true })
            .eq('id', user.id);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            supabaseClient
                .from('profiles')
                .update({ is_typing: false })
                .eq('id', user.id);
        }, 2000);
    } catch (error) {
        console.error('Send typing indicator error:', error);
    }
}

// ============================================
// MESSAGE OPERATIONS
// ============================================

async function deleteMessage(messageId) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ status: 'deleted' })
            .eq('id', messageId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete message error:', error);
        return false;
    }
}

async function editMessage(messageId, newContent) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({
                content: newContent,
                is_edited: true
            })
            .eq('id', messageId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Edit message error:', error);
        return false;
    }
}

// ============================================
// RENDER MESSAGE
// ============================================

function renderMessage(message, isOwn) {
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'sent' : 'received'}`;
    div.dataset.messageId = message.id;

    const content = document.createElement('div');
    content.className = 'message-content';

    if (message.type === 'text') {
        content.textContent = message.content;
    } else if (message.type === 'image') {
        const img = document.createElement('img');
        img.src = message.content;
        img.alt = 'Image message';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '12px';
        img.loading = 'lazy';
        content.appendChild(img);
    } else if (message.type === 'gif') {
        const img = document.createElement('img');
        img.src = message.content;
        img.alt = 'GIF message';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '12px';
        img.loading = 'lazy';
        content.appendChild(img);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatDate(message.created_at, 'relative');

    div.appendChild(content);
    div.appendChild(time);

    return div;
}

// ============================================
// LOAD CHAT
// ============================================

async function loadChat() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messages = await getMessages(50);
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <p>Belum ada pesan. Mulai percakapan! 💬</p>
            </div>
        `;
        return;
    }

    messages.forEach(msg => {
        const isOwn = msg.sender_id === currentUser?.id;
        const element = renderMessage(msg, isOwn);
        messagesContainer.appendChild(element);
    });

    // Scroll to bottom
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ============================================
// INIT CHAT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    if (!messageInput || !sendBtn) return;

    // Check auth
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Load messages
    await loadChat();

    // Subscribe to new messages
    subscribeToMessages((message) => {
        const isOwn = message.sender_id === currentUser?.id;
        const element = renderMessage(message, isOwn);
        document.getElementById('messages').appendChild(element);

        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    });

    // Send message
    const sendMessageHandler = async () => {
        const content = messageInput.value.trim();
        if (!content) return;

        const message = await sendMessage(content);
        if (message) {
            messageInput.value = '';
            const isOwn = true;
            const element = renderMessage(message, isOwn);
            document.getElementById('messages').appendChild(element);

            const container = document.getElementById('messages-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
    };

    sendBtn.addEventListener('click', sendMessageHandler);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageHandler();
        }
    });

    // Typing indicator
    messageInput.addEventListener('input', debounce(() => {
        sendTypingIndicator();
    }, 500));

    // Partner typing indicator subscription
    const partner = await getPartnerProfile();
    if (partner) {
        subscribeToPresence(partner.id, (profile) => {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                if (profile.is_typing) {
                    indicator.classList.remove('hidden');
                } else {
                    indicator.classList.add('hidden');
                }
            }
        });
    }
});

// ============================================
// EXPORTS
// ============================================

window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.subscribeToMessages = subscribeToMessages;
window.deleteMessage = deleteMessage;
window.editMessage = editMessage;
window.loadChat = loadChat;
window.sendTypingIndicator = sendTypingIndicator;

console.log('✅ Chat module loaded');
