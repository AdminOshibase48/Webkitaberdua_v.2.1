// ============================================
// SETTINGS MODULE - FIXED
// ============================================

// ============================================
// INIT SETTINGS
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if on settings page
    const currentPath = window.location.pathname.split('/').pop();
    if (!currentPath || !currentPath.includes('settings.html')) return;

    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Load all settings
        await loadSettings();

        // Setup event listeners
        setupSettingsListeners();

        // Update relationship info
        await updateRelationshipInfo();

        console.log('⚙️ Settings page initialized');
    } catch (error) {
        console.error('Settings init error:', error);
        showToast('Error loading settings', 'error');
    }
});

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupSettingsListeners() {
    // Update profile
    const updateProfileBtn = document.getElementById('update-profile');
    if (updateProfileBtn) {
        updateProfileBtn.removeEventListener('click', updateProfile);
        updateProfileBtn.addEventListener('click', updateProfile);
    }

    // Link partner
    const linkPartnerBtn = document.getElementById('link-partner');
    if (linkPartnerBtn) {
        linkPartnerBtn.removeEventListener('click', linkPartnerFromSettings);
        linkPartnerBtn.addEventListener('click', linkPartnerFromSettings);
    }

    // Unlink partner
    const unlinkPartnerBtn = document.getElementById('unlink-partner');
    if (unlinkPartnerBtn) {
        unlinkPartnerBtn.removeEventListener('click', unlinkPartner);
        unlinkPartnerBtn.addEventListener('click', unlinkPartner);
    }

    // Delete account
    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) {
        deleteAccountBtn.removeEventListener('click', deleteAccount);
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

    // Sign out
    const signOutBtn = document.getElementById('sign-out');
    if (signOutBtn) {
        signOutBtn.removeEventListener('click', handleSignOut);
        signOutBtn.addEventListener('click', handleSignOut);
    }

    // Export data
    const exportBtn = document.getElementById('export-data');
    if (exportBtn) {
        exportBtn.removeEventListener('click', exportData);
        exportBtn.addEventListener('click', exportData);
    }

    // Import data
    const importInput = document.getElementById('import-data');
    if (importInput) {
        importInput.removeEventListener('change', handleImport);
        importInput.addEventListener('change', handleImport);
    }

    // Test AI connection
    const testAIbtn = document.getElementById('test-ai-connection');
    if (testAIbtn) {
        testAIbtn.removeEventListener('click', testAIConnection);
        testAIbtn.addEventListener('click', testAIConnection);
    }

    // Analyze relationship
    const analyzeBtn = document.getElementById('ai-analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.removeEventListener('click', analyzeRelationshipHandler);
        analyzeBtn.addEventListener('click', analyzeRelationshipHandler);
    }
}

// ============================================
// HANDLER FUNCTIONS
// ============================================

async function handleImport(e) {
    if (e.target.files.length > 0) {
        await importData(e.target.files[0]);
        e.target.value = '';
    }
}

async function testAIConnection() {
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
}

async function analyzeRelationshipHandler() {
    const responseContainer = document.getElementById('ai-response');
    if (responseContainer) {
        responseContainer.textContent = '🔍 Menganalisis hubungan Anda...';
        responseContainer.style.color = 'var(--text-primary)';
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('API Key tidak ditemukan. Hubungi developer.', 'error');
        if (responseContainer) {
            responseContainer.textContent = '⚠️ API Key tidak ditemukan. Hubungi developer.';
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
        if (responseContainer) {
            responseContainer.textContent = '❌ Error: ' + error.message;
            responseContainer.style.color = 'var(--color-danger)';
        }
    }
}

async function handleSignOut() {
    try {
        const result = await signOut();
        if (result.success) {
            showToast('Berhasil keluar 👋', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
        } else {
            showToast('Gagal keluar: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Gagal keluar: ' + error.message, 'error');
    }
}

// ============================================
// EXPORT
// ============================================

console.log('✅ Settings module loaded');
