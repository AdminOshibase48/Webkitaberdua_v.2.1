// Settings Management
let settingsData = {
    profile: null,
    partner: null,
    theme: localStorage.getItem('theme') || 'light',
    aiModel: localStorage.getItem('ai_model') || 'google/gemini-2.0-flash-lite-preview-02-05:free'
};

// Load settings data
async function loadSettings() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        // Get user profile
        const profile = await getUserProfile();
        if (profile) {
            settingsData.profile = profile;
            populateProfileForm(profile);
        }

        // Get partner profile
        const partner = await getPartnerProfile();
        if (partner) {
            settingsData.partner = partner;
            populatePartnerForm(partner);
        }

        // Load theme
        const themeToggle = document.getElementById('dark-mode-toggle');
        if (themeToggle) {
            themeToggle.checked = settingsData.theme === 'dark';
        }

        // Load AI settings
        loadAISettings();

        // Update user email display
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

// Populate profile form
function populateProfileForm(profile) {
    const nameInput = document.getElementById('display-name');
    if (nameInput && profile.full_name) {
        nameInput.value = profile.full_name;
    }

    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview && profile.avatar_url) {
        avatarPreview.src = profile.avatar_url;
        avatarPreview.style.display = 'block';
    }
}

// Populate partner form
function populatePartnerForm(partner) {
    const partnerEmail = document.getElementById('partner-email-settings');
    if (partnerEmail && partner.email) {
        partnerEmail.value = partner.email;
        partnerEmail.disabled = true;
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

// Load AI settings
function loadAISettings() {
    const modelSelect = document.getElementById('ai-model-select');
    if (modelSelect) {
        const models = getAvailableModels();
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Add options
        Object.entries(models).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            if (value === settingsData.aiModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });

        // Handle model change
        modelSelect.addEventListener('change', (e) => {
            const newModel = e.target.value;
            settingsData.aiModel = newModel;
            setUserModel(newModel);
            showToast(`Model AI diubah ke: ${models[newModel] || newModel}`, 'success');
            updateAISettingsInfo();
        });
    }

    // Update AI settings info
    updateAISettingsInfo();
}

// Update AI settings info display
function updateAISettingsInfo() {
    const infoContainer = document.getElementById('ai-settings-info');
    if (!infoContainer) return;

    const currentModel = getUserModel();
    const models = getAvailableModels();
    const modelName = models[currentModel] || currentModel;
    const apiKey = getApiKey();

    infoContainer.innerHTML = `
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

// Update profile
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

        const { error } = await supabaseClient
            .from('profiles')
            .update({
                full_name: fullName,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) throw error;

        // Handle avatar upload if exists
        const avatarInput = document.getElementById('avatar-upload');
        if (avatarInput?.files?.length > 0) {
            const file = avatarInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `avatars/${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('profiles')
                .upload(fileName, file);

            if (!uploadError) {
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('profiles')
                    .getPublicUrl(fileName);

                await supabaseClient
                    .from('profiles')
                    .update({ avatar_url: publicUrl })
                    .eq('id', user.id);
            }
        }

        showToast('Profil berhasil diperbarui! ✅', 'success');
        
        // Refresh profile data
        const updatedProfile = await getUserProfile();
        if (updatedProfile) {
            settingsData.profile = updatedProfile;
            populateProfileForm(updatedProfile);
        }

        // Update UI elements
        const userNameElements = document.querySelectorAll('#user-name, .user-name');
        userNameElements.forEach(el => {
            el.textContent = fullName;
        });

        return true;
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Gagal memperbarui profil: ' + error.message, 'error');
        return false;
    }
}

// Link partner
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

        // Check if partner exists
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

        // Check existing relationship
        const { data: existingRel, error: relError } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

        if (existingRel) {
            // Update existing relationship
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
            // Create new relationship
            await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: user.id,
                    user2_id: partner.id,
                    status: 'active',
                    start_date: new Date().toISOString()
                });
        }

        // Update profiles
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

        // Refresh partner data
        const updatedPartner = await getPartnerProfile();
        if (updatedPartner) {
            settingsData.partner = updatedPartner;
            populatePartnerForm(updatedPartner);
        }

        return true;
    } catch (error) {
        console.error('Link partner error:', error);
        showToast('Gagal menghubungkan partner: ' + error.message, 'error');
        return false;
    }
}

// Unlink partner
async function unlinkPartner() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!confirm('Apakah Anda yakin ingin memutuskan hubungan dengan partner?')) {
            return;
        }

        // Get relationship
        const { data: rel, error: relError } = await supabaseClient
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

        // Update profiles
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
        
        // Clear partner data
        settingsData.partner = null;
        const partnerEmail = document.getElementById('partner-email-settings');
        if (partnerEmail) {
            partnerEmail.value = '';
            partnerEmail.disabled = false;
        }

        return true;
    } catch (error) {
        console.error('Unlink partner error:', error);
        showToast('Gagal memutuskan hubungan', 'error');
        return false;
    }
}

// Delete account
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

        // Delete user data from tables
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

        // Delete auth user
        const { error } = await supabaseClient.auth.admin.deleteUser(user.id);
        if (error) throw error;

        // Sign out
        await signOut();
        showToast('Akun berhasil dihapus. Semoga sukses selalu! 💕', 'success');
        window.location.href = '/';
        
        return true;
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('Gagal menghapus akun: ' + error.message, 'error');
        return false;
    }
}

// Sign out handler
async function handleSignOut() {
    try {
        const result = await signOut();
        if (result.success) {
            showToast('Berhasil keluar 👋', 'success');
            window.location.href = '/';
        } else {
            showToast('Gagal keluar: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Gagal keluar', 'error');
    }
}

// Export data
async function exportData() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        showToast('Mengumpulkan data... 📊', 'info');

        // Collect all user data
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

        // Also get partner data if exists
        const partner = await getPartnerProfile();
        if (partner) {
            data.partner = partner;
        }

        const relationship = await getRelationship();
        if (relationship) {
            data.relationship = relationship;
        }

        // Create JSON file
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

// Import data
async function importData(file) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        if (!confirm('⚠️ Mengimpor data akan menimpa data yang ada. Lanjutkan?')) {
            return;
        }

        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data
        if (!data.user || data.user.id !== user.id) {
            showToast('Data tidak valid atau bukan milik Anda', 'error');
            return;
        }

        showToast('Mengimpor data... ⏳', 'info');

        // Import each table
        const tables = ['messages', 'transactions', 'memories', 'events', 'notifications'];
        for (const table of tables) {
            if (data[table] && Array.isArray(data[table])) {
                for (const item of data[table]) {
                    // Check if exists
                    const { data: existing } = await supabaseClient
                        .from(table)
                        .select('id')
                        .eq('id', item.id)
                        .single();

                    if (existing) {
                        // Update
                        await supabaseClient
                            .from(table)
                            .update(item)
                            .eq('id', item.id);
                    } else {
                        // Insert
                        await supabaseClient
                            .from(table)
                            .insert(item);
                    }
                }
            }
        }

        showToast('Data berhasil diimpor! ✅', 'success');
        return true;
    } catch (error) {
        console.error('Import data error:', error);
        showToast('Gagal mengimpor data: ' + error.message, 'error');
        return false;
    }
}

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    // Load settings
    await loadSettings();

    // Set up event listeners
    setupSettingsEventListeners();

    // Update relationship info
    updateRelationshipInfo();

    // Set up import handler
    const importInput = document.getElementById('import-data');
    if (importInput) {
        importInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importData(e.target.files[0]);
                importInput.value = '';
            }
        });
    }

    console.log('⚙️ Settings page initialized');
});

// Setup event listeners
function setupSettingsEventListeners() {
    // Update profile
    const updateProfileBtn = document.getElementById('update-profile');
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener('click', updateProfile);
    }

    // Link partner
    const linkPartnerBtn = document.getElementById('link-partner');
    if (linkPartnerBtn) {
        linkPartnerBtn.addEventListener('click', linkPartnerFromSettings);
    }

    // Unlink partner
    const unlinkPartnerBtn = document.getElementById('unlink-partner');
    if (unlinkPartnerBtn) {
        unlinkPartnerBtn.addEventListener('click', unlinkPartner);
    }

    // Delete account
    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

    // Sign out
    const signOutBtn = document.getElementById('sign-out');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
    }

    // Export data
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    // Theme toggle
    const themeToggle = document.getElementById('dark-mode-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            applyTheme(theme);
            settingsData.theme = theme;
        });
    }

    // Test AI connection
    const testAIbtn = document.getElementById('test-ai-connection');
    if (testAIbtn) {
        testAIbtn.addEventListener('click', async () => {
            const result = await sendAIMessage('Hello! Please respond with a short greeting.');
            if (result) {
                showToast('✅ Koneksi AI berhasil!', 'success');
            } else {
                showToast('❌ Koneksi AI gagal. Periksa API key.', 'error');
            }
        });
    }

    // Analyze relationship
    const analyzeBtn = document.getElementById('ai-analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
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
    }
}

// Update relationship info
async function updateRelationshipInfo() {
    const relationship = await getRelationship();
    if (!relationship) return;

    const container = document.getElementById('relationship-info');
    if (!container) return;

    const startDate = new Date(relationship.start_date);
    const now = new Date();
    const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

    container.innerHTML = `
        <div class="relationship-stats">
            <div class="stat-item">
                <span class="stat-label">Together Since</span>
                <span class="stat-value">${startDate.toLocaleDateString()}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Days Together</span>
                <span class="stat-value">${diffDays} days</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Love Level</span>
                <span class="stat-value">❤️ ${relationship.love_level || 1}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Streak</span>
                <span class="stat-value">🔥 ${relationship.streak_days || 0} days</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Status</span>
                <span class="stat-value status-${relationship.status}">${relationship.status}</span>
            </div>
        </div>
    `;
}

// Export settings functions
window.loadSettings = loadSettings;
window.updateProfile = updateProfile;
window.linkPartnerFromSettings = linkPartnerFromSettings;
window.unlinkPartner = unlinkPartner;
window.deleteAccount = deleteAccount;
window.handleSignOut = handleSignOut;
window.exportData = exportData;
window.importData = importData;
window.updateAISettingsInfo = updateAISettingsInfo;
window.loadAISettings = loadAISettings;

console.log('⚙️ Settings module loaded');
