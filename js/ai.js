// ============================================
// AI ASSISTANT MODULE
// ============================================

// DEVELOPER API KEY - GANTI DENGAN API KEY ANDA
const DEVELOPER_API_KEY = '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';
const DEFAULT_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

let apiKey = DEVELOPER_API_KEY;
let userModel = localStorage.getItem('ai_model') || DEFAULT_MODEL;
let isStreaming = false;

// Available models
const AVAILABLE_MODELS = {
    'nvidia/nemotron-3-super-120b-a12b:free': 'NVIDIA: Nemotron 3 Super (free)',
    'google/gemma-4-26b-a4b-it:free': 'Google: Gemma 4 (Free)',
    'google/gemini-2.0-pro-exp-02-05:free': 'Gemini 2.0 Pro (Free)',
    'anthropic/claude-3.5-sonnet:beta': 'Claude 3.5 Sonnet',
    'anthropic/claude-3-haiku:beta': 'Claude 3 Haiku',
    'meta-llama/llama-3.2-3b-instruct:free': 'Llama 3.2 3B (Free)',
    'meta-llama/llama-3.1-8b-instruct:free': 'Llama 3.1 8B (Free)',
    'mistralai/mistral-7b-instruct:free': 'Mistral 7B (Free)',
    'openai/gpt-oss-120b:free': 'GPToss-120b ',
    'openai/gpt-4o': 'GPT-4o',
    'deepseek/deepseek-chat:free': 'DeepSeek Chat (Free)',
    'qwen/qwen-2.5-7b-instruct:free': 'Qwen 2.5 7B (Free)'
};

// ============================================
// GET APP CONTEXT
// ============================================

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

        let daysTogether = 0;
        if (relationship) {
            const startDate = new Date(relationship.start_date);
            const now = new Date();
            daysTogether = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
        }

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

// ============================================
// GET SYSTEM PROMPT
// ============================================

async function getSystemPrompt() {
    const context = await getAppContext();
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let contextStr = `Tanggal: ${dateStr}\n\n`;

    if (context) {
        contextStr += `INFORMASI USER:\n`;
        contextStr += `- Nama: ${context.user.name}\n`;
        contextStr += `- Email: ${context.user.email}\n`;

        if (context.partner) {
            contextStr += `\nINFORMASI PASANGAN:\n`;
            contextStr += `- Nama: ${context.partner.name}\n`;
            contextStr += `- Status: ${context.partner.status}\n`;
        }

        contextStr += `\nSTATUS HUBUNGAN:\n`;
        contextStr += `- Hari Bersama: ${context.relationship.daysTogether} hari\n`;
        contextStr += `- Status: ${context.relationship.status}\n`;
        contextStr += `- Level Cinta: ${context.relationship.loveLevel}\n`;
        contextStr += `- Streak: ${context.relationship.streak} hari\n`;
        contextStr += `- XP: ${context.stats.xp} | Level: ${context.stats.level}\n`;

        if (context.recentTransactions && context.recentTransactions.length > 0) {
            contextStr += `\nTRANSAKSI TERBARU:\n`;
            context.recentTransactions.forEach(t => {
                contextStr += `- ${t.type}: Rp ${t.amount} (${t.category || 'General'})\n`;
            });
        }

        if (context.recentMemories && context.recentMemories.length > 0) {
            contextStr += `\nKENANGAN TERBARU:\n`;
            context.recentMemories.forEach(m => {
                contextStr += `- ${m.title} (${m.date || 'No date'})\n`;
            });
        }

        if (context.upcomingEvents && context.upcomingEvents.length > 0) {
            contextStr += `\nEVENT MENDATANG:\n`;
            context.upcomingEvents.forEach(e => {
                contextStr += `- ${e.title} pada ${e.date} (${e.type})\n`;
            });
        }
    }

    return `Kamu adalah "LoveGuide", asisten AI yang penuh kasih untuk aplikasi couple "OurStory Together".

Kamu memiliki akses ke data hubungan user. Gunakan informasi ini untuk memberikan saran yang personal.

KEMAMPUAN UTAMA:
- Saran hubungan berdasarkan situasi spesifik pasangan
- Ide kencan personal
- Saran keuangan berdasarkan transaksi terbaru
- Motivasi berdasarkan milestone hubungan
- Analisis bahasa cinta
- Perencanaan anniversary
- Rekomendasi hadiah

ATURAN PENTING:
1. Bersikap hangat, suportif, dan penuh cinta
2. Gunakan emoji sesekali
3. Respons singkat (2-3 paragraf)
4. Selalu positif dan memberi semangat
5. Referensikan data hubungan mereka
6. Berikan saran yang bisa diimplementasikan

KONTEKS USER:
${contextStr}

Berdasarkan konteks ini, berikan respons yang personal dan membantu. Ingat, kamu adalah pendamping AI mereka! 💕`;
}

// ============================================
// SEND AI MESSAGE
// ============================================

async function sendAIMessage(message, context = []) {
    if (!apiKey) {
        showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
        return null;
    }

    try {
        isStreaming = true;
        updateAIStatus('Generating...', 'loading');

        const systemPrompt = await getSystemPrompt();

        const messages = [
            { role: 'system', content: systemPrompt },
            ...context,
            { role: 'user', content: message }
        ];

        console.log(`📤 Sending to AI model: ${userModel}`);

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
                            updateAIResponse(fullResponse);
                        }
                    } catch (e) {}
                }
            }
        }

        isStreaming = false;
        updateAIStatus('Siap', 'online');

        await saveAIHistory(message, fullResponse);
        console.log(`✅ AI response received (${fullResponse.length} chars)`);
        return fullResponse;

    } catch (error) {
        console.error('AI error:', error);
        isStreaming = false;
        updateAIStatus('Error', 'offline');
        showToast(`AI request failed: ${error.message}`, 'error');
        return null;
    }
}

// ============================================
// SAVE AI HISTORY
// ============================================

async function saveAIHistory(prompt, response) {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        await supabaseClient
            .from('ai_history')
            .insert({
                user_id: user.id,
                prompt: prompt,
                response: response,
                model: userModel
            });
    } catch (error) {
        console.error('Save AI history error:', error);
    }
}

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

// ============================================
// QUICK PROMPTS
// ============================================

const AI_TEMPLATES = {
    'relationship_advice': 'Berikan saya saran hubungan yang penuh kasih untuk hari ini. Gunakan data hubungan saya untuk saran yang personal.',
    'date_ideas': 'Sarankan 5 ide kencan yang kreatif dan romantis berdasarkan preferensi saya.',
    'motivation': 'Berikan saya motivasi cinta harian dan dorongan semangat.',
    'love_language': 'Bantu saya memahami bahasa cinta pasangan saya lebih baik. Analisis berdasarkan interaksi kami.',
    'anniversary': 'Bantu saya merencanakan perayaan anniversary yang spesial dan bermakna.',
    'gift': 'Sarankan ide hadiah yang bermakna untuk pasangan saya.',
    'analyze': 'Analisis hubungan saya secara lengkap dan berikan saran untuk meningkatkannya. Gunakan semua data yang tersedia.',
    'financial_advice': 'Berikan saya saran keuangan untuk pasangan berdasarkan transaksi kami.'
};

async function quickAIPrompt(type, context = '') {
    const template = AI_TEMPLATES[type] || AI_TEMPLATES.relationship_advice;
    const message = context ? `${template} ${context}` : template;
    return await sendAIMessage(message);
}

// ============================================
// UI FUNCTIONS
// ============================================

function updateAIResponse(text) {
    const container = document.getElementById('ai-response');
    if (container) {
        container.textContent = text;
        container.scrollTop = container.scrollHeight;
    }
}

function updateAIStatus(text, status) {
    const statusText = document.getElementById('ai-status-text');
    const statusDot = document.getElementById('ai-status-dot');
    
    if (statusText) statusText.textContent = text;
    if (statusDot) {
        statusDot.className = `status-dot ${status}`;
    }
}

function getAvailableModels() {
    return AVAILABLE_MODELS;
}

function getUserModel() {
    return userModel;
}

function setUserModel(model) {
    userModel = model;
    localStorage.setItem('ai_model', model);
    showToast(`Model AI diubah ke: ${AVAILABLE_MODELS[model] || model}`, 'success');
}

function getApiKey() {
    return apiKey;
}

// ============================================
// INIT AI
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if on AI page
    if (!window.location.pathname.includes('ai.html')) return;

    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Update model display
    const modelDisplay = document.getElementById('ai-model-display');
    if (modelDisplay) {
        modelDisplay.textContent = AVAILABLE_MODELS[userModel] || userModel;
    }

    // Update status
    updateAIStatus('Siap', 'online');

    // Setup chat
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const loading = document.getElementById('ai-loading');

    if (!input || !sendBtn) return;

    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        if (!apiKey) {
            showToast('⚠️ API Key tidak ditemukan. Hubungi developer.', 'error');
            return;
        }

        // Add user message
        addAIMessage('user', message);
        input.value = '';

        if (loading) loading.classList.remove('hidden');
        updateAIStatus('Generating...', 'loading');

        const response = await sendAIMessage(message);

        if (loading) loading.classList.add('hidden');
        updateAIStatus('Siap', 'online');

        if (response) {
            addAIMessage('assistant', response);
        } else {
            addAIMessage('assistant', 'Maaf, saya mengalami masalah. Silakan coba lagi nanti. 😅');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Quick action buttons
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const type = btn.dataset.type;
            if (!apiKey) {
                showToast('⚠️ API Key tidak ditemukan. Hubungi developer.', 'error');
                return;
            }

            const message = AI_TEMPLATES[type] || 'Halo!';
            addAIMessage('user', message);

            if (loading) loading.classList.remove('hidden');
            updateAIStatus('Generating...', 'loading');

            const response = await quickAIPrompt(type);

            if (loading) loading.classList.add('hidden');
            updateAIStatus('Siap', 'online');

            if (response) {
                addAIMessage('assistant', response);
            } else {
                addAIMessage('assistant', 'Maaf, saya mengalami masalah. Silakan coba lagi nanti. 😅');
            }
        });
    });
});

// ============================================
// ADD AI MESSAGE
// ============================================

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
        bubble.innerHTML = content.replace(/\n/g, '<br>');
        messageDiv.appendChild(bubble);
    } else {
        const bubble = document.createElement('div');
        bubble.className = 'ai-bubble user-bubble';
        bubble.textContent = content;
        messageDiv.appendChild(bubble);
    }

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ============================================
// EXPORTS
// ============================================

window.sendAIMessage = sendAIMessage;
window.quickAIPrompt = quickAIPrompt;
window.getAIHistory = getAIHistory;
window.getAvailableModels = getAvailableModels;
window.getUserModel = getUserModel;
window.setUserModel = setUserModel;
window.getApiKey = getApiKey;
window.addAIMessage = addAIMessage;
window.updateAIStatus = updateAIStatus;

console.log('✅ AI module loaded');
