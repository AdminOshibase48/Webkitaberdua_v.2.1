// AI Assistant functionality
// DEVELOPER API KEY - Ganti dengan API Key Anda
const DEVELOPER_API_KEY = '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';
const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';

let apiKey = DEVELOPER_API_KEY; // Gunakan API Key developer
let userModel = localStorage.getItem('ai_model') || DEFAULT_MODEL;
let aiMessages = [];
let isStreaming = false;

// Get available models from OpenRouter
const AVAILABLE_MODELS = {
    'openai/gpt-oss-120b:free': 'OpenAI: gpt (Free)',
    'nvidia/nemotron-3-super-120b-a12b:free': 'NVIDIA: Nemotron 3 Super (free)',
    'google/gemini-2.0-pro-exp-02-05:free': 'Gemini 2.0 Pro (Free)',
    'anthropic/claude-3.5-sonnet:beta': 'Claude 3.5 Sonnet',
    'anthropic/claude-3-haiku:beta': 'Claude 3 Haiku',
    'meta-llama/llama-3.2-3b-instruct:free': 'Llama 3.2 3B (Free)',
    'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B (Free)',
    'mistralai/mistral-7b-instruct:free': 'Mistral 7B (Free)',
    'openai/gpt-4o-mini': 'GPT-4o Mini',
    'openai/gpt-4o': 'GPT-4o',
    'deepseek/deepseek-chat:free': 'DeepSeek Chat (Free)',
    'qwen/qwen-2.5-7b-instruct:free': 'Qwen 2.5 7B (Free)'
};

// Set API key (for developer override)
function setDeveloperApiKey(key) {
    apiKey = key || DEVELOPER_API_KEY;
    localStorage.setItem('developer_api_key', key);
}

// Get API key
function getApiKey() {
    return apiKey;
}

// Set user's preferred model
function setUserModel(model) {
    userModel = model;
    localStorage.setItem('ai_model', model);
    showToast(`Model AI diubah ke: ${AVAILABLE_MODELS[model] || model}`, 'success');
}

// Get user's model
function getUserModel() {
    return userModel;
}

// Get available models list
function getAvailableModels() {
    return AVAILABLE_MODELS;
}

// Get application context for AI analysis
async function getAppContext() {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const profile = await getUserProfile();
        const partner = await getPartnerProfile();
        const relationship = await getRelationship();

        // Get recent transactions
        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        // Get recent memories
        const { data: memories } = await supabaseClient
            .from('memories')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3);

        // Get upcoming events
        const today = new Date().toISOString().split('T')[0];
        const { data: events } = await supabaseClient
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(5);

        // Calculate relationship days
        let daysTogether = 0;
        if (relationship) {
            const startDate = new Date(relationship.start_date);
            const now = new Date();
            daysTogether = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
        }

        // Get user stats
        const { data: stats } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', user.id)
            .single();

        return {
            user: {
                name: profile?.full_name || user.email,
                email: user.email
            },
            partner: partner ? {
                name: partner.full_name || partner.email,
                status: partner.status || 'offline'
            } : null,
            relationship: {
                daysTogether: daysTogether,
                status: relationship?.status || 'pending',
                loveLevel: relationship?.love_level || 1,
                streak: relationship?.streak_days || 0
            },
            recentTransactions: transactions || [],
            recentMemories: memories || [],
            upcomingEvents: events || [],
            stats: stats || { xp: 0, level: 1 }
        };
    } catch (error) {
        console.error('Error getting app context:', error);
        return null;
    }
}

// Get system prompt with context
async function getSystemPromptWithContext() {
    const context = await getAppContext();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let contextStr = `Current Date: ${dateStr}\n\n`;

    if (context) {
        contextStr += `USER INFORMATION:\n`;
        contextStr += `- Name: ${context.user.name}\n`;
        contextStr += `- Email: ${context.user.email}\n`;

        if (context.partner) {
            contextStr += `\nPARTNER INFORMATION:\n`;
            contextStr += `- Name: ${context.partner.name}\n`;
            contextStr += `- Status: ${context.partner.status}\n`;
        }

        contextStr += `\nRELATIONSHIP STATUS:\n`;
        contextStr += `- Days Together: ${context.relationship.daysTogether} days\n`;
        contextStr += `- Relationship Status: ${context.relationship.status}\n`;
        contextStr += `- Love Level: ${context.relationship.loveLevel}\n`;
        contextStr += `- Current Streak: ${context.relationship.streak} days\n`;
        contextStr += `- XP: ${context.stats.xp} | Level: ${context.stats.level}\n`;

        if (context.recentTransactions && context.recentTransactions.length > 0) {
            contextStr += `\nRECENT TRANSACTIONS:\n`;
            context.recentTransactions.forEach(t => {
                contextStr += `- ${t.type}: Rp ${t.amount} (${t.category || 'General'})\n`;
            });
        }

        if (context.recentMemories && context.recentMemories.length > 0) {
            contextStr += `\nRECENT MEMORIES:\n`;
            context.recentMemories.forEach(m => {
                contextStr += `- ${m.title} (${m.date || 'No date'})\n`;
            });
        }

        if (context.upcomingEvents && context.upcomingEvents.length > 0) {
            contextStr += `\nUPCOMING EVENTS:\n`;
            context.upcomingEvents.forEach(e => {
                contextStr += `- ${e.title} on ${e.date} (${e.type})\n`;
            });
        }
    }

    // Add app information
    contextStr += `\nAPP INFORMATION:\n`;
    contextStr += `- App Name: OurStory Together\n`;
    contextStr += `- Version: 1.0.0\n`;
    contextStr += `- AI Model: ${userModel}\n`;

    return `You are "LoveGuide", a loving and wise relationship assistant for the "OurStory Together" couple app. 

You have access to the user's relationship data and app context. Use this information to provide personalized advice and insights.

KEY CAPABILITIES:
- Relationship advice based on the couple's specific situation
- Personalized date ideas considering their preferences
- Financial advice tailored to their recent transactions
- Motivation based on their relationship milestones
- Love language analysis
- Anniversary planning with their important dates
- Gift recommendations based on their interests

IMPORTANT RULES:
1. Be warm, supportive, and loving in your tone
2. Use emojis occasionally to feel friendly
3. Keep responses concise (2-3 paragraphs max)
4. Always be positive and encouraging
5. Reference their specific relationship data when relevant
6. Give actionable advice they can implement
7. If you don't know something, be honest about it

USER CONTEXT:
${contextStr}

Based on this context, provide helpful, personalized responses. Remember, you're their AI relationship companion! 💕`;
}

// Send message to AI with context
async function sendAIMessage(message, context = []) {
    if (!apiKey) {
        showToast('AI API Key tidak ditemukan. Hubungi developer.', 'error');
        return null;
    }

    try {
        isStreaming = true;

        // Get system prompt with context
        const systemPrompt = await getSystemPromptWithContext();

        // Prepare messages
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            ...context,
            {
                role: 'user',
                content: message
            }
        ];

        console.log(`📤 Sending request to AI model: ${userModel}`);
        console.log(`📋 Context size: ${systemPrompt.length} characters`);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'OurStory Together'
            },
            body: JSON.stringify({
                model: userModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        // Read stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            fullResponse += content;
                            // Update UI with streaming response
                            updateAIResponse(fullResponse);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }
        }

        isStreaming = false;

        // Save to history
        await saveAIHistory(message, fullResponse);

        console.log(`✅ AI response received (${fullResponse.length} characters)`);
        return fullResponse;
    } catch (error) {
        console.error('AI error:', error);
        isStreaming = false;
        showToast(`AI request failed: ${error.message}`, 'error');
        return null;
    }
}

// Save AI history
async function saveAIHistory(prompt, response) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const { error } = await supabaseClient
            .from('ai_history')
            .insert({
                user_id: user.id,
                prompt: prompt,
                response: response,
                model: userModel,
                created_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (error) {
        console.error('Save AI history error:', error);
    }
}

// Get AI history
async function getAIHistory(limit = 20) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabaseClient
            .from('ai_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get AI history error:', error);
        return [];
    }
}

// Update AI response in UI
function updateAIResponse(text) {
    const responseContainer = document.getElementById('ai-response');
    if (responseContainer) {
        responseContainer.textContent = text;
        // Scroll to bottom
        responseContainer.scrollTop = responseContainer.scrollHeight;
    }
}

// AI prompt templates
const AI_TEMPLATES = {
    'relationship_advice': "Berikan saya saran hubungan yang penuh kasih untuk hari ini: ",
    'date_ideas': "Sarankan 5 ide kencan yang kreatif dan romantis: ",
    'financial_advice': "Berikan saya saran keuangan untuk pasangan: ",
    'motivation': "Berikan saya motivasi cinta harian dan dorongan semangat: ",
    'love_language': "Bantu saya memahami bahasa cinta pasangan saya lebih baik: ",
    'anniversary': "Bantu saya merencanakan perayaan anniversary yang spesial: ",
    'gift': "Sarankan ide hadiah yang bermakna untuk pasangan saya: ",
    'analyze': "Analisis hubungan saya dan berikan saran untuk meningkatkannya: "
};

// Quick AI prompts
async function quickAIPrompt(type, context = '') {
    const template = AI_TEMPLATES[type] || AI_TEMPLATES.relationship_advice;
    const message = context ? `${template} ${context}` : template;
    return await sendAIMessage(message);
}

// Analyze relationship with context
async function analyzeRelationship() {
    const context = await getAppContext();
    if (!context) {
        showToast('Gagal mendapatkan konteks hubungan', 'error');
        return null;
    }

    const prompt = `Analisis hubungan saya berdasarkan data berikut:
- Hari bersama: ${context.relationship.daysTogether} hari
- Status: ${context.relationship.status}
- Level cinta: ${context.relationship.loveLevel}
- Streak: ${context.relationship.streak} hari
- XP: ${context.stats.xp} | Level: ${context.stats.level}

${context.partner ? `Pasangan: ${context.partner.name} (${context.partner.status})` : 'Belum memiliki pasangan'}

${context.recentMemories.length > 0 ? `Memori terbaru: ${context.recentMemories.map(m => m.title).join(', ')}` : ''}
${context.upcomingEvents.length > 0 ? `Event mendatang: ${context.upcomingEvents.map(e => e.title).join(', ')}` : ''}

Berikan analisis lengkap tentang hubungan saya dan saran untuk meningkatkannya.`;

    return await sendAIMessage(prompt);
}

// Initialize AI features
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');
    const responseContainer = document.getElementById('ai-response');
    const modelSelect = document.getElementById('ai-model-select');
    const statusIndicator = document.getElementById('ai-status');

    // Populate model selector
    if (modelSelect) {
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Add options
        Object.entries(AVAILABLE_MODELS).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            if (value === userModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });

        // Handle model change
        modelSelect.addEventListener('change', (e) => {
            const newModel = e.target.value;
            setUserModel(newModel);
            // Update status
            if (statusIndicator) {
                statusIndicator.textContent = `Model: ${AVAILABLE_MODELS[newModel] || newModel}`;
            }
        });

        // Update status
        if (statusIndicator) {
            statusIndicator.textContent = `Model: ${AVAILABLE_MODELS[userModel] || userModel}`;
        }
    }

    // Add analyze button
    const analyzeBtn = document.getElementById('ai-analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!apiKey) {
                showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
                return;
            }

            if (responseContainer) {
                responseContainer.textContent = '🔍 Menganalisis hubungan Anda...';
            }

            const response = await analyzeRelationship();
            if (response) {
                // Show response
                if (responseContainer) {
                    responseContainer.textContent = response;
                }
            }
        });
    }

    if (sendBtn && input) {
        sendBtn.addEventListener('click', async () => {
            const message = input.value.trim();
            if (!message) return;

            if (!apiKey) {
                showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
                return;
            }

            // Show loading
            if (responseContainer) {
                responseContainer.textContent = '💭 Sedang berpikir...';
            }

            const response = await sendAIMessage(message);
            if (response) {
                input.value = '';
                // Save to recent prompts
                const history = JSON.parse(localStorage.getItem('ai_recent_prompts') || '[]');
                history.unshift({ prompt: message, response: response, time: Date.now() });
                if (history.length > 10) history.pop();
                localStorage.setItem('ai_recent_prompts', JSON.stringify(history));
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });
    }

    // Quick prompt buttons
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.type;
            if (!apiKey) {
                showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
                return;
            }

            if (responseContainer) {
                responseContainer.textContent = '💭 Sedang berpikir...';
            }

            const response = await quickAIPrompt(type);
            if (response) {
                if (responseContainer) {
                    responseContainer.textContent = response;
                }
            }
        });
    });

    // Update UI with current settings info
    const settingsInfo = document.getElementById('ai-settings-info');
    if (settingsInfo) {
        settingsInfo.innerHTML = `
            <div class="settings-info">
                <p>🔑 API Key: ${apiKey ? '✅ Terkonfigurasi (Developer)' : '❌ Tidak ditemukan'}</p>
                <p>🤖 Model: ${AVAILABLE_MODELS[userModel] || userModel}</p>
                <p>📊 Status: ${isStreaming ? '⏳ Memproses...' : '✅ Siap digunakan'}</p>
            </div>
        `;
    }
});

// Export functions
window.setDeveloperApiKey = setDeveloperApiKey;
window.getApiKey = getApiKey;
window.setUserModel = setUserModel;
window.getUserModel = getUserModel;
window.getAvailableModels = getAvailableModels;
window.sendAIMessage = sendAIMessage;
window.quickAIPrompt = quickAIPrompt;
window.getAIHistory = getAIHistory;
window.analyzeRelationship = analyzeRelationship;
window.getAppContext = getAppContext;

console.log('🤖 AI Module Loaded with Developer API Key');
console.log(`📋 Available Models: ${Object.keys(AVAILABLE_MODELS).length}`);
console.log(`🔑 API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
console.log(`🤖 Current Model: ${userModel}`);
// ============================================
// AI PAGE SPECIFIC FUNCTIONS
// ============================================

// Initialize AI page
async function initAIPage() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Update model display
    const modelDisplay = document.getElementById('ai-model-display');
    if (modelDisplay) {
        const currentModel = getUserModel();
        const models = getAvailableModels();
        modelDisplay.textContent = models[currentModel] || currentModel;
    }

    // Update context status
    const contextStatus = document.getElementById('ai-context-status');
    if (contextStatus) {
        const apiKey = getApiKey();
        if (apiKey) {
            contextStatus.textContent = '✅ Dengan konteks aplikasi';
            contextStatus.style.color = '#34c759';
        } else {
            contextStatus.textContent = '⚠️ Tanpa konteks (API Key missing)';
            contextStatus.style.color = '#ff9500';
        }
    }

    // Setup AI chat
    setupAIChat();

    // Setup quick action buttons
    setupQuickActions();

    console.log('🤖 AI Page initialized');
}

// Setup AI chat functionality
function setupAIChat() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const messagesContainer = document.getElementById('ai-messages');
    const loading = document.getElementById('ai-loading');

    if (!input || !sendBtn) return;

    // Send message function
    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        // Check API key
        const apiKey = getApiKey();
        if (!apiKey) {
            showToast('⚠️ API Key tidak ditemukan. Hubungi developer.', 'error');
            return;
        }

        // Add user message to UI
        addAIMessage('user', message);
        input.value = '';

        // Show loading
        if (loading) loading.classList.remove('hidden');
        updateAIStatus('Generating...', 'loading');

        // Send to AI
        const response = await sendAIMessage(message);

        // Hide loading
        if (loading) loading.classList.add('hidden');
        updateAIStatus('Siap', 'online');

        if (response) {
            // Add AI response to UI
            addAIMessage('assistant', response);
            
            // Save to history
            saveAIHistory(message, response);
        } else {
            addAIMessage('assistant', 'Maaf, saya mengalami masalah. Silakan coba lagi nanti. 😅');
        }
    }

    // Event listeners
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto focus input
    input.focus();
}

// Add message to AI chat
function addAIMessage(role, content) {
    const container = document.getElementById('ai-messages');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-${role}`;

    if (role === 'assistant') {
        const avatar = document.createElement('div');
        avatar.className = 'ai-avatar';
        avatar.textContent = '🤖';
        messageDiv.appendChild(avatar);

        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble';
        
        // Format content with markdown-like styling
        const formattedContent = formatAIContent(content);
        bubble.innerHTML = formattedContent;
        
        messageDiv.appendChild(bubble);
    } else {
        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble user-bubble';
        bubble.textContent = content;
        messageDiv.appendChild(bubble);
    }

    container.appendChild(messageDiv);
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Format AI content (adds basic markdown)
function formatAIContent(content) {
    // Convert newlines to <br>
    let formatted = content.replace(/\n/g, '<br>');
    
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert bullet points
    formatted = formatted.replace(/• (.*?)(<br>|$)/g, '• $1$2');
    
    return formatted;
}

// Setup quick action buttons
function setupQuickActions() {
    const buttons = document.querySelectorAll('.ai-quick-btn');
    const loading = document.getElementById('ai-loading');

    buttons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.type;
            const apiKey = getApiKey();
            
            if (!apiKey) {
                showToast('⚠️ API Key tidak ditemukan. Hubungi developer.', 'error');
                return;
            }

            // Get template message
            const templates = {
                'relationship_advice': 'Berikan saya saran hubungan yang penuh kasih untuk hari ini. Tolong gunakan data hubungan saya untuk memberikan saran yang personal.',
                'date_ideas': 'Sarankan 5 ide kencan yang kreatif dan romantis berdasarkan preferensi saya.',
                'motivation': 'Berikan saya motivasi cinta harian dan dorongan semangat.',
                'love_language': 'Bantu saya memahami bahasa cinta pasangan saya lebih baik. Analisis berdasarkan interaksi kami.',
                'anniversary': 'Bantu saya merencanakan perayaan anniversary yang spesial dan bermakna.',
                'gift': 'Sarankan ide hadiah yang bermakna untuk pasangan saya.',
                'analyze': 'Analisis hubungan saya secara lengkap dan berikan saran untuk meningkatkannya. Gunakan semua data yang tersedia.',
                'financial_advice': 'Berikan saya saran keuangan untuk pasangan berdasarkan transaksi kami.'
            };

            const message = templates[type] || 'Halo!';
            
            // Add user message
            addAIMessage('user', message);

            // Show loading
            if (loading) loading.classList.remove('hidden');
            updateAIStatus('Generating...', 'loading');

            // Send to AI
            const response = await quickAIPrompt(type);

            // Hide loading
            if (loading) loading.classList.add('hidden');
            updateAIStatus('Siap', 'online');

            if (response) {
                addAIMessage('assistant', response);
                saveAIHistory(message, response);
            } else {
                addAIMessage('assistant', 'Maaf, saya mengalami masalah. Silakan coba lagi nanti. 😅');
            }
        });
    });
}

// Update AI status
function updateAIStatus(text, status) {
    const statusText = document.getElementById('ai-status-text');
    const statusDot = document.getElementById('ai-status-dot');
    
    if (statusText) statusText.textContent = text;
    if (statusDot) {
        statusDot.className = `status-dot ${status}`;
    }
}

// Load AI history
async function loadAIHistory() {
    try {
        const history = await getAIHistory(20);
        const container = document.getElementById('ai-messages');
        if (!container) return;

        // Clear welcome message if history exists
        if (history.length > 0) {
            // Keep only the last 10 messages
            const recent = history.slice(0, 10);
            recent.reverse().forEach(item => {
                // Add user message
                addAIMessage('user', item.prompt);
                // Add AI response
                addAIMessage('assistant', item.response);
            });
            
            // Add a separator
            const separator = document.createElement('div');
            separator.className = 'ai-history-separator';
            separator.innerHTML = '<hr><span style="font-size: 0.8rem; color: var(--text-secondary);">Riwayat sebelumnya</span><hr>';
            container.prepend(separator);
        }
    } catch (error) {
        console.error('Error loading AI history:', error);
    }
}

// Clear AI history
async function clearAIHistory() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!confirm('Hapus semua riwayat chat AI?')) return;

        const { error } = await supabaseClient
            .from('ai_history')
            .delete()
            .eq('user_id', user.id);

        if (error) throw error;
        
        // Reload page to clear messages
        showToast('Riwayat AI berhasil dihapus', 'success');
        window.location.reload();
    } catch (error) {
        console.error('Error clearing AI history:', error);
        showToast('Gagal menghapus riwayat', 'error');
    }
}

// Override init for AI page
document.addEventListener('DOMContentLoaded', async () => {
    // Check if we're on AI page
    if (window.location.pathname.includes('ai.html')) {
        await initAIPage();
        await loadAIHistory();
    }
});

// Export new functions
window.initAIPage = initAIPage;
window.addAIMessage = addAIMessage;
window.loadAIHistory = loadAIHistory;
window.clearAIHistory = clearAIHistory;
window.updateAIStatus = updateAIStatus;
