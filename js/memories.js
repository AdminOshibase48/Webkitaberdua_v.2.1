// Memories functionality
let currentMemories = [];

// Add memory
async function addMemory(title, description, type, file, date) {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        let fileUrl = null;
        if (file) {
            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('memories')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('memories')
                .getPublicUrl(fileName);

            fileUrl = urlData.publicUrl;
        }

        const memory = {
            user_id: user.id,
            title: title,
            description: description,
            type: type,
            file_url: fileUrl,
            date: date || new Date().toISOString().split('T')[0]
        };

        const { data, error } = await supabaseClient
            .from('memories')
            .insert(memory)
            .select()
            .single();

        if (error) throw error;

        // Add XP for creating memories
        await addXP(10);

        return data;
    } catch (error) {
        console.error('Add memory error:', error);
        return null;
    }
}

// Get memories
async function getMemories(limit = 50) {
    try {
        const user = await getCurrentUser();
        if (!user) return [];

        // Get user's memories and partner's memories
        const profile = await getUserProfile();
        const partnerId = profile?.partner_id;

        let query = supabaseClient
            .from('memories')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (partnerId) {
            // Also get partner's memories
            const { data: partnerMemories, error: partnerError } = await supabaseClient
                .from('memories')
                .select('*')
                .eq('user_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (!partnerError) {
                const { data: userMemories, error: userError } = await query;
                if (!userError) {
                    const combined = [...userMemories, ...partnerMemories];
                    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    currentMemories = combined.slice(0, limit);
                    return currentMemories;
                }
            }
        }

        const { data, error } = await query;
        if (error) throw error;
        currentMemories = data;
        return data;
    } catch (error) {
        console.error('Get memories error:', error);
        return [];
    }
}

// Delete memory
async function deleteMemory(memoryId) {
    try {
        const { error } = await supabaseClient
            .from('memories')
            .delete()
            .eq('id', memoryId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Delete memory error:', error);
        return false;
    }
}

// Like memory
async function likeMemory(memoryId) {
    try {
        const user = await getCurrentUser();
        if (!user) return false;

        // Check if already liked
        const { data: existing, error: checkError } = await supabaseClient
            .from('memory_likes')
            .select('*')
            .eq('memory_id', memoryId)
            .eq('user_id', user.id)
            .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;

        if (existing) {
            // Unlike
            const { error: deleteError } = await supabaseClient
                .from('memory_likes')
                .delete()
                .eq('id', existing.id);

            if (deleteError) throw deleteError;
            return false;
        } else {
            // Like
            const { error: insertError } = await supabaseClient
                .from('memory_likes')
                .insert({
                    memory_id: memoryId,
                    user_id: user.id
                });

            if (insertError) throw insertError;
            return true;
        }
    } catch (error) {
        console.error('Like memory error:', error);
        return false;
    }
}

// Add comment to memory
async function addComment(memoryId, content) {
    try {
        const user = await getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabaseClient
            .from('memory_comments')
            .insert({
                memory_id: memoryId,
                user_id: user.id,
                content: content
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Add comment error:', error);
        return null;
    }
}

// Render memory card
function renderMemoryCard(memory) {
    const card = document.createElement('div');
    card.className = 'memory-card';

    if (memory.file_url) {
        const img = document.createElement('img');
        img.className = 'memory-image';
        img.src = memory.file_url;
        img.alt = memory.title;
        img.loading = 'lazy';
        card.appendChild(img);
    }

    const title = document.createElement('div');
    title.className = 'memory-title';
    title.textContent = memory.title;

    const date = document.createElement('div');
    date.className = 'memory-date';
    date.textContent = new Date(memory.date || memory.created_at).toLocaleDateString();

    const description = document.createElement('div');
    description.className = 'memory-description';
    description.textContent = memory.description || '';

    card.appendChild(title);
    card.appendChild(date);
    if (memory.description) card.appendChild(description);

    return card;
}

// Load memories
async function loadMemories(filter = 'all') {
    const container = document.getElementById('memories-grid');
    if (!container) return;

    const memories = await getMemories(50);
    container.innerHTML = '';

    if (!memories || memories.length === 0) {
        container.innerHTML = '<p class="empty-state">No memories yet. Start capturing your moments! 📸</p>';
        return;
    }

    // Filter
    let filtered = memories;
    if (filter !== 'all') {
        filtered = memories.filter(m => m.type === filter);
    }

    filtered.forEach(memory => {
        const card = renderMemoryCard(memory);
        container.appendChild(card);
    });
}

// Initialize memories
document.addEventListener('DOMContentLoaded', async () => {
    // Load memories
    await loadMemories();

    // Add memory button
    const addBtn = document.getElementById('add-memory-btn');
    const modal = document.getElementById('memory-modal');
    const closeModalBtn = document.getElementById('close-memory-modal');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('hidden');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('hidden');
        });
    }

    // Memory form
    const memoryForm = document.getElementById('memory-form');
    if (memoryForm) {
        memoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('memory-title').value;
            const description = document.getElementById('memory-description').value;
            const type = document.getElementById('memory-type').value;
            const file = document.getElementById('memory-file').files[0];
            const date = document.getElementById('memory-date').value;

            const result = await addMemory(title, description, type, file, date);
            if (result) {
                showToast('Memory saved! 📸', 'success');
                modal.classList.add('hidden');
                memoryForm.reset();
                await loadMemories();
            } else {
                showToast('Failed to save memory', 'error');
            }
        });
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadMemories(btn.dataset.filter);
        });
    });
});

// Export functions
window.addMemory = addMemory;
window.getMemories = getMemories;
window.deleteMemory = deleteMemory;
window.likeMemory = likeMemory;
window.addComment = addComment;
window.loadMemories = loadMemories;
