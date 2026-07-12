// ============================================
// AUTH HANDLERS - FULL VERSION
// ============================================

// ============================================
// LOGIN FORM HANDLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // ============================================
    // LOGIN FORM
    // ============================================
    
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const email = emailInput?.value?.trim();
            const password = passwordInput?.value;

            // Validasi
            if (!email || !password) {
                showToast('⚠️ Email dan password wajib diisi', 'error');
                emailInput?.focus();
                return;
            }

            // Disable button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Loading...';
            }

            try {
                console.log('🔑 Attempting login for:', email);
                const result = await signIn(email, password);
                
                if (result.success) {
                    showToast('✅ Selamat datang kembali! 💕', 'success');
                    console.log('✅ Login successful, redirecting...');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    showToast('❌ ' + (result.error || 'Login gagal'), 'error');
                    console.error('Login failed:', result.error);
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Masuk';
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                showToast('❌ Terjadi kesalahan: ' + error.message, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Masuk';
                }
            }
        });
    }

    // ============================================
    // REGISTER FORM
    // ============================================
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nameInput = document.getElementById('full-name');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const partnerEmailInput = document.getElementById('partner-email');
            
            const fullName = nameInput?.value?.trim();
            const email = emailInput?.value?.trim();
            const password = passwordInput?.value;
            const partnerEmail = partnerEmailInput?.value?.trim() || null;

            // Validasi
            if (!fullName || !email || !password) {
                showToast('⚠️ Semua field wajib diisi', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('⚠️ Password minimal 6 karakter', 'error');
                passwordInput?.focus();
                return;
            }

            if (!isValidEmail(email)) {
                showToast('⚠️ Format email tidak valid', 'error');
                emailInput?.focus();
                return;
            }

            if (partnerEmail && !isValidEmail(partnerEmail)) {
                showToast('⚠️ Format email partner tidak valid', 'error');
                partnerEmailInput?.focus();
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Mendaftar...';
            }

            try {
                const result = await signUp(email, password, fullName, partnerEmail);
                
                if (result.success) {
                    showToast('✅ Akun berhasil dibuat! 🎉', 'success');
                    console.log('✅ Registration successful, redirecting...');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    showToast('❌ ' + (result.error || 'Registrasi gagal'), 'error');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Buat Akun ✨';
                    }
                }
            } catch (error) {
                console.error('Registration error:', error);
                showToast('❌ Terjadi kesalahan: ' + error.message, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Buat Akun ✨';
                }
            }
        });
    }

    // ============================================
    // SIGN OUT BUTTON
    // ============================================
    
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

    // ============================================
    // FORGOT PASSWORD
    // ============================================
    
    const forgotLink = document.querySelector('.forgot-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Masukkan email untuk reset password:');
            if (email) {
                if (!isValidEmail(email)) {
                    showToast('⚠️ Format email tidak valid', 'error');
                    return;
                }
                
                try {
                    const result = await resetPassword(email);
                    if (result.success) {
                        showToast('✅ Email reset password telah dikirim! 📧', 'success');
                    } else {
                        showToast('❌ Gagal mengirim email reset: ' + (result.error || 'Unknown error'), 'error');
                    }
                } catch (error) {
                    showToast('❌ Gagal: ' + error.message, 'error');
                }
            }
        });
    }

    // ============================================
    // ENTER KEY SHORTCUT
    // ============================================
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.closest('form')) {
                const form = activeElement.closest('form');
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.click();
                }
            }
        }
    });

    // ============================================
    // AUTO LOGIN CHECK
    // ============================================
    
    // Cek jika user sudah login dan di halaman auth
    const currentPath = window.location.pathname.split('/').pop();
    const authPages = ['login.html', 'register.html', 'index.html'];
    
    if (authPages.includes(currentPath)) {
        getCurrentUser().then(user => {
            if (user) {
                console.log('User already logged in, redirecting to dashboard');
                window.location.href = 'dashboard.html';
            }
        });
    }
});

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
    return password && password.length >= 6;
}

// ============================================
// EXPORT
// ============================================

console.log('✅ Auth module loaded');
