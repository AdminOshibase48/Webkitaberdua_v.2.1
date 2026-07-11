// Chat functionality
let chatChannel = null;
let currentMessages = [];
let isTyping = false;
let typingTimeout = null;

// Send message
async function sendMessage(content, type = 'text', metadata = {}) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

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

        // Update relationship XP
        await addXP(5);

        return data;
    } catch (error) {
        console.error('Send message error:', error);
        return null;
    }
}

// Get messages
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

// Subscribe to messages
function subscribeToMessages(callback) {
    try {
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

// Send typing indicator
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

// Delete message
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

// Edit message
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

// Render message
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
        content.appendChild(img);
    } else if (message.type === 'gif') {
        const img = document.createElement('img');
        img.src = message.content;
        img.alt = 'GIF message';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '12px';
        content.appendChild(img);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.created_at).toLocaleTimeString();

    div.appendChild(content);
    div.appendChild(time);

    return div;
}

// Load chat
async function loadChat() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;

    const messages = await getMessages();
    messagesContainer.innerHTML = '';

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

// Initialize chat
document.addEventListener('DOMContentLoaded', async () => {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');

    if (messageInput && sendBtn) {
        // Load messages
        await loadChat();

        // Subscribe to new messages
        subscribeToMessages((message) => {
            const isOwn = message.sender_id === currentUser?.id;
            const element = renderMessage(message, isOwn);
            document.getElementById('messages').appendChild(element);

            // Scroll to bottom
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
            if (e.key === 'Enter') {
                sendMessageHandler();
            }
        });

        // Typing indicator
        messageInput.addEventListener('input', () => {
            sendTypingIndicator();
        });
    }
});

// Export functions
window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.subscribeToMessages = subscribeToMessages;
window.deleteMessage = deleteMessage;
window.editMessage = editMessage;
window.loadChat = loadChat;
