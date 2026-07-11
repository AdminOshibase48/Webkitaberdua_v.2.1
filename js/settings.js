// ============================================
// SETTINGS MODULE
// ============================================

let settingsData = {
    profile: null,
    partner: null,
    theme: localStorage.getItem('theme') || 'light',
    aiModel: localStorage.getItem('ai_model') || 'nvidia/nemotron-3-super-120b-a12b:free'
};

// ============================================
// LOAD SETTINGS
// ============================================

async function loadSettings() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const profile = await getUserProfile();
        if (profile) {
            settingsData.profile = profile;
            populateProfileForm(profile);
        }

        const partner = await getPartnerProfile();
        if (partner) {
            settingsData.partner = partner;
            populatePartnerForm(partner);
        }

        const themeToggle = document.getElementById('dark-mode-toggle');
        if (themeToggle) {
            themeToggle.checked = settingsData.theme === 'dark';
        }

        loadAISettings();
        updateRelationshipInfo();

        const emailEl = document.getElementById('user-email');
        if (emailEl) {
            emailEl.textContent = user.email;
        }

        return settingsData;
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Gagal memuat pengaturan', 'error');
        return null;
    }
}

// ============================================
// POPULATE FORMS
// ============================================

function populateProfileForm(profile) {
    const nameInput = document.getElementById('display-name');
    if (nameInput && profile.full_name) {
        nameInput.value = profile.full_name;
    }
}

function populatePartnerForm(partner) {
    const partnerEmail = document.getElementById('partner-email-settings');
    if (partnerEmail && partner.email) {
        partnerEmail.value = partner.email;
    }

    const partnerNameDisplay = document.getElementById('partner-name-display');
    if (partnerNameDisplay && partner.full_name) {
        partnerNameDisplay.textContent = partner.full_name;
    }

    const partnerStatus = document.getElementById('partner-status-display');
    if (partnerStatus && partner.status) {
        partnerStatus.textContent = partner.status;
        partnerStatus.className = `status-${partner.status}`;
    }
}

// ============================================
// AI SETTINGS
// ============================================

function loadAISettings() {
    const modelSelect = document.getElementById('ai-model-select');
    if (!modelSelect) return;

    const models = getAvailableModels();
    modelSelect.innerHTML = '';

    Object.entries(models).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (value === settingsData.aiModel) {
            option.selected = true;
        }
        modelSelect.appendChild(option);
    });

    modelSelect.addEventListener('change', (e) => {
        const newModel = e.target.value;
        settingsData.aiModel = newModel;
        setUserModel(newModel);
        updateAISettingsInfo();
    });

    updateAISettingsInfo();
}

function updateAISettingsInfo() {
    const container = document.getElementById('ai-settings-info');
    if (!container) return;

    const currentModel = getUserModel();
    const models = getAvailableModels();
    const modelName = models[currentModel] || currentModel;
    const apiKey = getApiKey();

    container.innerHTML = `
        <div class="settings-info">
            <p>🔑 <span class="label">API Key:</span> ${apiKey ? '✅ Terkonfigurasi (Developer)' : '❌ Tidak ditemukan'}</p>
            <p>🤖 <span class="label">Current Model:</span> ${modelName}</p>
            <p>📊 <span class="label">Status:</span> ✅ Siap digunakan</p>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">
                💡 API Key disimpan oleh developer. Model dapat diubah sesuai kebutuhan.
            </p>
        </div>
    `;
}

// ============================================
// UPDATE PROFILE
// ============================================

async function updateProfile() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        const nameInput = document.getElementById('display-name');
        const fullName = nameInput?.value?.trim();

        if (!fullName) {
            showToast('Nama tidak boleh kosong', 'error');
            return;
        }

        await supabaseClient
            .from('profiles')
            .update({
                full_name: fullName,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        showToast('Profil berhasil diperbarui! ✅', 'success');
        
        const updatedProfile = await getUserProfile();
        if (updatedProfile) {
            settingsData.profile = updatedProfile;
            populateProfileForm(updatedProfile);
        }

        document.querySelectorAll('#user-name, .user-name').forEach(el => {
            el.textContent = fullName;
        });

        return true;
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Gagal memperbarui profil', 'error');
        return false;
    }
}

// ============================================
// LINK PARTNER
// ============================================

async function linkPartnerFromSettings() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        const emailInput = document.getElementById('partner-email-settings');
        const partnerEmail = emailInput?.value?.trim();

        if (!partnerEmail) {
            showToast('Masukkan email partner', 'error');
            return;
        }

        if (!isValidEmail(partnerEmail)) {
            showToast('Email tidak valid', 'error');
            return;
        }

        const { data: partner, error: findError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', partnerEmail)
            .single();

        if (findError || !partner) {
            showToast('Partner tidak ditemukan. Pastikan mereka sudah mendaftar.', 'error');
            return;
        }

        if (partner.id === user.id) {
            showToast('Tidak bisa menghubungkan dengan diri sendiri', 'error');
            return;
        }

        const { data: existingRel } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

        if (existingRel) {
            if (existingRel.user1_id === user.id) {
                await supabaseClient
                    .from('relationships')
                    .update({ user2_id: partner.id, status: 'active' })
                    .eq('id', existingRel.id);
            } else {
                await supabaseClient
                    .from('relationships')
                    .update({ user1_id: partner.id, status: 'active' })
                    .eq('id', existingRel.id);
            }
        } else {
            await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: user.id,
                    user2_id: partner.id,
                    status: 'active',
                    start_date: new Date().toISOString()
                });
        }

        await supabaseClient
            .from('profiles')
            .update({ partner_id: partner.id })
            .eq('id', user.id);

        await supabaseClient
            .from('profiles')
            .update({ partner_id: user.id })
            .eq('id', partner.id);

        showToast(`Berhasil terhubung dengan ${partner.full_name}! 💕`, 'success');
        showConfetti(30);

        const updatedPartner = await getPartnerProfile();
        if (updatedPartner) {
            settingsData.partner = updatedPartner;
            populatePartnerForm(updatedPartner);
        }

        updateRelationshipInfo();
        return true;
    } catch (error) {
        console.error('Link partner error:', error);
        showToast('Gagal menghubungkan partner', 'error');
        return false;
    }
}

// ============================================
// UNLINK PARTNER
// ============================================

async function unlinkPartner() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!confirm('Apakah Anda yakin ingin memutuskan hubungan dengan partner?')) {
            return;
        }

        const { data: rel } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

        if (rel) {
            await supabaseClient
                .from('relationships')
                .update({ status: 'inactive', user2_id: null })
                .eq('id', rel.id);
        }

        await supabaseClient
            .from('profiles')
            .update({ partner_id: null })
            .eq('id', user.id);

        const partner = await getPartnerProfile();
        if (partner) {
            await supabaseClient
                .from('profiles')
                .update({ partner_id: null })
                .eq('id', partner.id);
        }

        showToast('Berhasil memutuskan hubungan 💔', 'info');
        
        settingsData.partner = null;
        const partnerEmail = document.getElementById('partner-email-settings');
        if (partnerEmail) {
            partnerEmail.value = '';
        }

        updateRelationshipInfo();
        return true;
    } catch (error) {
        console.error('Unlink partner error:', error);
        showToast('Gagal memutuskan hubungan', 'error');
        return false;
    }
}

// ============================================
// DELETE ACCOUNT
// ============================================

async function deleteAccount() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!confirm('⚠️ Apakah Anda yakin ingin menghapus akun? Semua data akan hilang permanen!')) {
            return;
        }

        if (!confirm('Sekali lagi, apakah Anda benar-benar yakin? Ini tidak bisa dibatalkan!')) {
            return;
        }

        const tables = [
            'profiles', 'relationships', 'messages', 'transactions',
            'memories', 'memory_likes', 'memory_comments', 'events',
            'notifications', 'ai_history', 'user_stats', 'budgets', 'savings_goals'
        ];

        for (const table of tables) {
            await supabaseClient
                .from(table)
                .delete()
                .eq('user_id', user.id);
        }

        await supabaseClient.auth.admin.deleteUser(user.id);
        await signOut();
        
        showToast('Akun berhasil dihapus. Semoga sukses selalu! 💕', 'success');
        window.location.href = 'index.html';
        return true;
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Gagal menghapus akun', 'error');
        return false;
    }
}

// ============================================
// EXPORT/IMPORT DATA
// ============================================

async function exportData() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        showToast('Mengumpulkan data... 📊', 'info');

        const tables = [
            'profiles', 'relationships', 'messages', 'transactions',
            'memories', 'memory_likes', 'memory_comments', 'events',
            'notifications', 'ai_history', 'user_stats', 'budgets', 'savings_goals'
        ];

        const data = { user: { id: user.id, email: user.email } };

        for (const table of tables) {
            const { data: tableData, error } = await supabaseClient
                .from(table)
                .select('*')
                .eq('user_id', user.id);

            if (!error) {
                data[table] = tableData;
            }
        }

        const partner = await getPartnerProfile();
        if (partner) data.partner = partner;

        const relationship = await getRelationship();
        if (relationship) data.relationship = relationship;

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ourstory-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Data berhasil diekspor! 📥', 'success');
    } catch (error) {
        console.error('Export data error:', error);
        showToast('Gagal mengekspor data', 'error');
    }
}

// ============================================
// RELATIONSHIP INFO
// ============================================

async function updateRelationshipInfo() {
    const container = document.getElementById('relationship-info');
    if (!container) return;

    const relationship = await getRelationship();
    if (!relationship) {
        container.innerHTML = '<p class="empty-state">Belum ada hubungan yang terhubung</p>';
        return;
    }

    const startDate = new Date(relationship.start_date);
    const now = new Date();
    const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    container.innerHTML = `
        <div class="relationship-stats">
            <div class="stat-item">
                <span class="stat-label">Together Since</span>
                <span class="stat-value">${formatDate(startDate, 'long')}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Days Together</span>
                <span class="stat-value">${diffDays} hari</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Love Level</span>
                <span class="stat-value">❤️ ${relationship.love_level || 1}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Streak</span>
                <span class="stat-value">🔥 ${relationship.streak_days || 0} hari</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Status</span>
                <span class="stat-value status-${relationship.status}">${relationship.status}</span>
            </div>
        </div>
    `;
}

// ============================================
// INIT SETTINGS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if on settings page
    if (!window.location.pathname.includes('settings.html')) return;

    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    await loadSettings();

    // Event listeners
    document.getElementById('update-profile')?.addEventListener('click', updateProfile);
    document.getElementById('link-partner')?.addEventListener('click', linkPartnerFromSettings);
    document.getElementById('unlink-partner')?.addEventListener('click', unlinkPartner);
    document.getElementById('delete-account')?.addEventListener('click', deleteAccount);
    document.getElementById('export-data')?.addEventListener('click', exportData);
    document.getElementById('sign-out')?.addEventListener('click', async () => {
        const result = await signOut();
        if (result.success) {
            showToast('Berhasil keluar 👋', 'success');
            window.location.href = 'index.html';
        }
    });

    // Test AI connection
    document.getElementById('test-ai-connection')?.addEventListener('click', async () => {
        const result = await sendAIMessage('Hello! Please respond with a short greeting.');
        if (result) {
            showToast('✅ Koneksi AI berhasil!', 'success');
        } else {
            showToast('❌ Koneksi AI gagal. Periksa API key.', 'error');
        }
    });

    // Analyze relationship
    document.getElementById('ai-analyze-btn')?.addEventListener('click', async () => {
        const responseContainer = document.getElementById('ai-response');
        if (responseContainer) {
            responseContainer.textContent = '🔍 Menganalisis hubungan Anda...';
        }

        const apiKey = getApiKey();
        if (!apiKey) {
            showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
            return;
        }

        const response = await analyzeRelationship();
        if (response && responseContainer) {
            responseContainer.textContent = response;
        }
    });
});

// ============================================
// EXPORTS
// ============================================

window.loadSettings = loadSettings;
window.updateProfile = updateProfile;
window.linkPartnerFromSettings = linkPartnerFromSettings;
window.unlinkPartner = unlinkPartner;
window.deleteAccount = deleteAccount;
window.exportData = exportData;
window.updateRelationshipInfo = updateRelationshipInfo;

console.log('✅ Settings module loaded');
