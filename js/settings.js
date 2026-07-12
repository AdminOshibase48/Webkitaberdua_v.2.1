// ============================================
// SETTINGS MODULE - FULL FIX
// ============================================

let settingsData = {
    profile: null,
    partner: null,
    theme: localStorage.getItem('theme') || 'light',
    aiModel: localStorage.getItem('ai_model') || 'nvidia/nemotron-3-super-120b-a12b:free'
};

// ============================================
// AUTH GUARD - CEK LOGIN
// ============================================

async function checkAuthAndRedirect() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            console.log('🔒 User not authenticated, redirecting to login...');
            showToast('Silakan login terlebih dahulu', 'error', 2000);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 500);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        showToast('Error autentikasi, redirecting...', 'error', 2000);
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
        return false;
    }
}

// ============================================
// LOAD SETTINGS
// ============================================

async function loadSettings() {
    try {
        // Cek auth dulu
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return null;

        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return null;
        }

        // Load profile
        const profile = await getUserProfile();
        if (profile) {
            settingsData.profile = profile;
            populateProfileForm(profile);
        }

        // Load partner
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

        // Update relationship info
        await updateRelationshipInfo();

        // Update user email
        const emailEl = document.getElementById('user-email');
        if (emailEl) {
            emailEl.textContent = user.email || 'Email tidak tersedia';
        }

        console.log('✅ Settings loaded successfully');
        return settingsData;
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Gagal memuat pengaturan: ' + error.message, 'error');
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

    // Avatar preview
    const avatarPreview = document.getElementById('avatar-preview');
    if (avatarPreview && profile.avatar_url) {
        avatarPreview.src = profile.avatar_url;
        avatarPreview.style.display = 'block';
    }
}

function populatePartnerForm(partner) {
    const partnerEmail = document.getElementById('partner-email-settings');
    if (partnerEmail && partner.email) {
        partnerEmail.value = partner.email;
        partnerEmail.disabled = true;
    }

    const partnerNameDisplay = document.getElementById('partner-name-display');
    if (partnerNameDisplay && partner.full_name) {
        partnerNameDisplay.textContent = partner.full_name;
    } else if (partnerNameDisplay) {
        partnerNameDisplay.textContent = 'Belum terhubung';
    }

    const partnerStatus = document.getElementById('partner-status-display');
    if (partnerStatus && partner.status) {
        partnerStatus.textContent = partner.status;
        partnerStatus.className = `status-${partner.status}`;
    } else if (partnerStatus) {
        partnerStatus.textContent = '-';
        partnerStatus.className = 'status-offline';
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
        showToast(`Model AI diubah ke: ${models[newModel] || newModel}`, 'success');
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
        <div class="settings-info" style="padding: 1rem; background: var(--card-bg); border-radius: var(--radius-sm); border: 1px solid var(--card-border);">
            <p style="margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                🔑 <span style="font-weight: 600; color: var(--text-secondary);">API Key:</span> 
                ${apiKey ? '✅ Terkonfigurasi (Developer)' : '❌ Tidak ditemukan'}
            </p>
            <p style="margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                🤖 <span style="font-weight: 600; color: var(--text-secondary);">Current Model:</span> 
                ${modelName}
            </p>
            <p style="margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
                📊 <span style="font-weight: 600; color: var(--text-secondary);">Status:</span> 
                ✅ Siap digunakan
            </p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; border-top: 1px solid var(--card-border); padding-top: 0.5rem;">
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
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return false;

        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return false;
        }

        const nameInput = document.getElementById('display-name');
        const fullName = nameInput?.value?.trim();

        if (!fullName) {
            showToast('Nama tidak boleh kosong', 'error');
            nameInput?.focus();
            return false;
        }

        // Update profile
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                full_name: fullName,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) throw error;

        // Handle avatar upload
        const avatarInput = document.getElementById('avatar-upload');
        if (avatarInput?.files?.length > 0) {
            const file = avatarInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `avatars/${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('profiles')
                .upload(fileName, file, { upsert: true });

            if (!uploadError) {
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('profiles')
                    .getPublicUrl(fileName);

                await supabaseClient
                    .from('profiles')
                    .update({ avatar_url: publicUrl })
                    .eq('id', user.id);
                
                // Update avatar preview
                const preview = document.getElementById('avatar-preview');
                if (preview) {
                    preview.src = publicUrl;
                    preview.style.display = 'block';
                }
            }
        }

        showToast('✅ Profil berhasil diperbarui!', 'success');
        
        // Refresh profile
        const updatedProfile = await getUserProfile(user.id);
        if (updatedProfile) {
            settingsData.profile = updatedProfile;
            populateProfileForm(updatedProfile);
        }

        // Update UI elements
        document.querySelectorAll('#user-name, .user-name').forEach(el => {
            el.textContent = fullName;
        });

        return true;
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('❌ Gagal memperbarui profil: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// LINK PARTNER
// ============================================

async function linkPartnerFromSettings() {
    try {
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return false;

        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return false;
        }

        const emailInput = document.getElementById('partner-email-settings');
        const partnerEmail = emailInput?.value?.trim();

        if (!partnerEmail) {
            showToast('Masukkan email partner', 'error');
            emailInput?.focus();
            return false;
        }

        if (!isValidEmail(partnerEmail)) {
            showToast('Format email tidak valid', 'error');
            emailInput?.focus();
            return false;
        }

        if (partnerEmail === user.email) {
            showToast('Tidak bisa menghubungkan dengan diri sendiri', 'error');
            return false;
        }

        // Cari partner
        const { data: partner, error: findError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', partnerEmail)
            .single();

        if (findError || !partner) {
            showToast('❌ Partner tidak ditemukan. Pastikan mereka sudah mendaftar.', 'error');
            return false;
        }

        // Cek relationship existing
        const { data: existingRel } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

        if (existingRel) {
            // Update existing
            if (existingRel.user1_id === user.id) {
                await supabaseClient
                    .from('relationships')
                    .update({ 
                        user2_id: partner.id, 
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingRel.id);
            } else {
                await supabaseClient
                    .from('relationships')
                    .update({ 
                        user1_id: partner.id, 
                        status: 'active',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingRel.id);
            }
        } else {
            // Create new
            await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: user.id,
                    user2_id: partner.id,
                    status: 'active',
                    start_date: new Date().toISOString(),
                    love_level: 1,
                    streak_days: 0
                });
        }

        // Update profiles
        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: partner.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', partner.id);

        // Add XP
        await addXP(user.id, 50);

        showToast(`✅ Berhasil terhubung dengan ${partner.full_name}! 💕`, 'success');
        showConfetti(30);

        // Refresh partner data
        const updatedPartner = await getPartnerProfile();
        if (updatedPartner) {
            settingsData.partner = updatedPartner;
            populatePartnerForm(updatedPartner);
        }

        await updateRelationshipInfo();

        // Disable email input
        if (emailInput) {
            emailInput.disabled = true;
        }

        return true;
    } catch (error) {
        console.error('Link partner error:', error);
        showToast('❌ Gagal menghubungkan partner: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// UNLINK PARTNER
// ============================================

async function unlinkPartner() {
    try {
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return false;

        const user = await getCurrentUser();
        if (!user) return false;

        if (!confirm('⚠️ Apakah Anda yakin ingin memutuskan hubungan dengan partner?')) {
            return false;
        }

        // Get relationship
        const { data: rel } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
            .single();

        if (rel) {
            await supabaseClient
                .from('relationships')
                .update({ 
                    status: 'inactive', 
                    user2_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', rel.id);
        }

        // Get partner
        const partner = await getPartnerProfile();

        // Update current user
        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        // Update partner if exists
        if (partner) {
            await supabaseClient
                .from('profiles')
                .update({ 
                    partner_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', partner.id);
        }

        partnerProfile = null;
        relationshipData = null;

        // Reset form
        const partnerEmail = document.getElementById('partner-email-settings');
        if (partnerEmail) {
            partnerEmail.value = '';
            partnerEmail.disabled = false;
        }

        const partnerNameDisplay = document.getElementById('partner-name-display');
        if (partnerNameDisplay) {
            partnerNameDisplay.textContent = 'Belum terhubung';
        }

        const partnerStatus = document.getElementById('partner-status-display');
        if (partnerStatus) {
            partnerStatus.textContent = '-';
            partnerStatus.className = 'status-offline';
        }

        showToast('💔 Berhasil memutuskan hubungan', 'info');
        await updateRelationshipInfo();
        return true;
    } catch (error) {
        console.error('Unlink partner error:', error);
        showToast('❌ Gagal memutuskan hubungan: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// DELETE ACCOUNT
// ============================================

async function deleteAccount() {
    try {
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return false;

        const user = await getCurrentUser();
        if (!user) return false;

        if (!confirm('⚠️ Apakah Anda yakin ingin menghapus akun? Semua data akan hilang permanen!')) {
            return false;
        }

        if (!confirm('Sekali lagi, apakah Anda benar-benar yakin? Ini tidak bisa dibatalkan!')) {
            return false;
        }

        // Delete user data from all tables
        const tables = [
            'profiles', 'relationships', 'messages', 'transactions',
            'memories', 'memory_likes', 'memory_comments', 'events',
            'notifications', 'ai_history', 'user_stats', 'budgets', 'savings_goals'
        ];

        for (const table of tables) {
            try {
                await supabaseClient
                    .from(table)
                    .delete()
                    .eq('user_id', user.id);
            } catch (e) {
                console.log(`Skipping ${table}:`, e.message);
            }
        }

        // Delete auth user
        const { error } = await supabaseClient.auth.admin.deleteUser(user.id);
        if (error) throw error;

        // Sign out
        await signOut();
        
        showToast('✅ Akun berhasil dihapus. Semoga sukses selalu! 💕', 'success');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
        
        return true;
    } catch (error) {
        console.error('Delete account error:', error);
        showToast('❌ Gagal menghapus akun: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// EXPORT/IMPORT DATA
// ============================================

async function exportData() {
    try {
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return;

        const user = await getCurrentUser();
        if (!user) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        showToast('📊 Mengumpulkan data...', 'info');

        const tables = [
            'profiles', 'relationships', 'messages', 'transactions',
            'memories', 'memory_likes', 'memory_comments', 'events',
            'notifications', 'ai_history', 'user_stats', 'budgets', 'savings_goals'
        ];

        const data = { 
            user: { 
                id: user.id, 
                email: user.email,
                exported_at: new Date().toISOString()
            } 
        };

        for (const table of tables) {
            try {
                const { data: tableData, error } = await supabaseClient
                    .from(table)
                    .select('*')
                    .eq('user_id', user.id);

                if (!error && tableData) {
                    data[table] = tableData;
                }
            } catch (e) {
                console.log(`Skipping ${table}:`, e.message);
            }
        }

        // Get partner and relationship
        const partner = await getPartnerProfile();
        if (partner) data.partner = partner;

        const relationship = await getRelationship();
        if (relationship) data.relationship = relationship;

        // Create JSON file
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ourstory-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Data berhasil diekspor! 📥', 'success');
    } catch (error) {
        console.error('Export data error:', error);
        showToast('❌ Gagal mengekspor data: ' + error.message, 'error');
    }
}

async function importData(file) {
    try {
        const isAuth = await checkAuthAndRedirect();
        if (!isAuth) return;

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
            showToast('❌ Data tidak valid atau bukan milik Anda', 'error');
            return;
        }

        showToast('⏳ Mengimpor data...', 'info');

        // Import each table
        const tables = ['messages', 'transactions', 'memories', 'events', 'notifications'];
        let importCount = 0;

        for (const table of tables) {
            if (data[table] && Array.isArray(data[table])) {
                for (const item of data[table]) {
                    try {
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
                        importCount++;
                    } catch (e) {
                        console.log(`Skip ${table} item:`, e.message);
                    }
                }
            }
        }

        showToast(`✅ Berhasil mengimpor ${importCount} data!`, 'success');
        return true;
    } catch (error) {
        console.error('Import data error:', error);
        showToast('❌ Gagal mengimpor data: ' + error.message, 'error');
        return false;
    }
}

// ============================================
// RELATIONSHIP INFO
// ============================================

async function updateRelationshipInfo() {
    const container = document.getElementById('relationship-info');
    if (!container) return;

    try {
        const relationship = await getRelationship();
        if (!relationship) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 1rem 0;">
                    <p style="color: var(--text-secondary);">Belum ada hubungan yang terhubung</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Hubungkan dengan pasangan untuk mulai</p>
                </div>
            `;
            return;
        }

        const startDate = new Date(relationship.start_date);
        const now = new Date();
        const diffDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));

        container.innerHTML = `
            <div class="relationship-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.75rem;">
                <div class="stat-item" style="padding: 0.75rem; background: var(--card-bg); border-radius: var(--radius-sm); text-align: center;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Bersama Sejak</span>
                    <span style="font-size: 0.95rem; font-weight: 600;">${formatDate(startDate, 'short')}</span>
                </div>
                <div class="stat-item" style="padding: 0.75rem; background: var(--card-bg); border-radius: var(--radius-sm); text-align: center;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Hari Bersama</span>
                    <span style="font-size: 0.95rem; font-weight: 600;">${diffDays} hari</span>
                </div>
                <div class="stat-item" style="padding: 0.75rem; background: var(--card-bg); border-radius: var(--radius-sm); text-align: center;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Level Cinta</span>
                    <span style="font-size: 0.95rem; font-weight: 600;">❤️ ${relationship.love_level || 1}</span>
                </div>
                <div class="stat-item" style="padding: 0.75rem; background: var(--card-bg); border-radius: var(--radius-sm); text-align: center;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Streak</span>
                    <span style="font-size: 0.95rem; font-weight: 600;">🔥 ${relationship.streak_days || 0} hari</span>
                </div>
                <div class="stat-item" style="padding: 0.75rem; background: var(--card-bg); border-radius: var(--radius-sm); text-align: center;">
                    <span style="display: block; font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">Status</span>
                    <span style="font-size: 0.95rem; font-weight: 600; color: ${relationship.status === 'active' ? '#34c759' : '#ff9500'};">${relationship.status === 'active' ? '✅ Aktif' : '⏳ Menunggu'}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Update relationship info error:', error);
        container.innerHTML = `
            <div class="empty-state" style="padding: 1rem 0;">
                <p style="color: var(--text-secondary);">Gagal memuat data hubungan</p>
            </div>
        `;
    }
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupSettingsListeners() {
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
        signOutBtn.addEventListener('click', async () => {
            try {
                const result = await signOut();
                if (result.success) {
                    showToast('✅ Berhasil keluar 👋', 'success');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 500);
                } else {
                    showToast('❌ Gagal keluar: ' + (result.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                showToast('❌ Gagal keluar: ' + error.message, 'error');
            }
        });
    }

    // Export data
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    // Import data
    const importInput = document.getElementById('import-data');
    if (importInput) {
        importInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await importData(e.target.files[0]);
                e.target.value = '';
            }
        });
    }

    // Test AI connection
    const testAIbtn = document.getElementById('test-ai-connection');
    if (testAIbtn) {
        testAIbtn.addEventListener('click', async () => {
            try {
                const result = await sendAIMessage('Hello! Please respond with a short greeting.');
                if (result) {
                    showToast('✅ Koneksi AI berhasil!', 'success');
                } else {
                    showToast('❌ Koneksi AI gagal. Periksa API key.', 'error');
                }
            } catch (error) {
                showToast('❌ Koneksi AI gagal: ' + error.message, 'error');
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
                responseContainer.style.color = 'var(--text-primary)';
            }

            const apiKey = getApiKey();
            if (!apiKey) {
                showToast('⚠️ API Key tidak ditemukan. Hubungi developer.', 'error');
                if (responseContainer) {
                    responseContainer.textContent = '⚠️ API Key tidak ditemukan. Hubungi developer.';
                    responseContainer.style.color = 'var(--color-danger)';
                }
                return;
            }

            try {
                const response = await analyzeRelationship();
                if (response && responseContainer) {
                    responseContainer.textContent = response;
                    responseContainer.style.color = 'var(--text-primary)';
                } else if (responseContainer) {
                    responseContainer.textContent = '⚠️ Gagal menganalisis hubungan. Silakan coba lagi.';
                    responseContainer.style.color = 'var(--color-danger)';
                }
            } catch (error) {
                console.error('Analyze error:', error);
                if (responseContainer) {
                    responseContainer.textContent = '❌ Error: ' + error.message;
                    responseContainer.style.color = 'var(--color-danger)';
                }
            }
        });
    }

    console.log('✅ Settings event listeners setup complete');
}

// ============================================
// INIT SETTINGS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if on settings page
    const currentPath = window.location.pathname.split('/').pop();
    if (!currentPath || !currentPath.includes('settings.html')) return;

    console.log('⚙️ Initializing settings page...');

    try {
        // CEK AUTH - PASTIKAN USER LOGIN
        const user = await getCurrentUser();
        if (!user) {
            console.log('🔒 No user found, redirecting to login...');
            showToast('Silakan login terlebih dahulu', 'error', 2000);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 500);
            return;
        }

        console.log('✅ User authenticated:', user.email);

        // Load all settings
        await loadSettings();

        // Setup event listeners
        setupSettingsListeners();

        // Update relationship info
        await updateRelationshipInfo();

        // Update user email display
        const emailEl = document.getElementById('user-email');
        if (emailEl) {
            emailEl.textContent = user.email || 'Email tidak tersedia';
        }

        console.log('⚙️ Settings page ready!');
    } catch (error) {
        console.error('Settings init error:', error);
        showToast('Error loading settings: ' + error.message, 'error');
        
        // Jika error auth, redirect ke login
        if (error.message.includes('auth') || error.message.includes('session')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
        }
    }
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
window.importData = importData;
window.updateRelationshipInfo = updateRelationshipInfo;
window.checkAuthAndRedirect = checkAuthAndRedirect;

console.log('✅ Settings module loaded');
