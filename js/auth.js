// ============================================
// AUTH HANDLERS - FIXED VERSION
// ============================================

// ============================================
// PASTIKAN FUNGSI DARI SUPABASE.JS TERSEDIA
// ============================================

// Tunggu sampai supabase.js selesai loading
document.addEventListener('DOMContentLoaded', () => {
    console.log('📋 Auth.js initialized');
    console.log('🔍 Checking supabase functions...');
    console.log('✅ signUp:', typeof window.signUp);
    console.log('✅ signIn:', typeof window.signIn);
    console.log('✅ signOut:', typeof window.signOut);
    console.log('✅ resetPassword:', typeof window.resetPassword);
});

// ============================================
// LOGIN FORM HANDLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;

            if (!email || !password) {
                showToast('Mohon isi semua field', 'error');
                return;
            }

            // Cek apakah fungsi signIn tersedia
            if (typeof window.signIn !== 'function') {
                showToast('Error: Fungsi signIn tidak tersedia. Refresh halaman.', 'error');
                console.error('❌ signIn function not found');
                return;
            }

            try {
                const result = await window.signIn(email, password);
                if (result.success) {
                    showToast('Selamat datang kembali! 💕', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    showToast(result.error || 'Login gagal', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showToast('Terjadi kesalahan saat login', 'error');
            }
        });
    }
});

// ============================================
// REGISTER FORM HANDLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('full-name')?.value;
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;
            const partnerEmail = document.getElementById('partner-email')?.value || null;

            if (!fullName || !email || !password) {
                showToast('Mohon isi semua field', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('Password minimal 6 karakter', 'error');
                return;
            }

            // Cek apakah fungsi signUp tersedia
            if (typeof window.signUp !== 'function') {
                showToast('Error: Fungsi signUp tidak tersedia. Refresh halaman.', 'error');
                console.error('❌ signUp function not found');
                return;
            }

            try {
                const result = await window.signUp(email, password, fullName, partnerEmail);
                if (result.success) {
                    showToast('Akun berhasil dibuat! 🎉', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    showToast(result.error || 'Registrasi gagal', 'error');
                }
            } catch (error) {
                console.error('Register error:', error);
                showToast('Terjadi kesalahan saat registrasi', 'error');
            }
        });
    }
});

// ============================================
// SIGN OUT HANDLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const signOutBtn = document.getElementById('sign-out');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            if (typeof window.signOut !== 'function') {
                showToast('Error: Fungsi signOut tidak tersedia', 'error');
                return;
            }

            try {
                const result = await window.signOut();
                if (result.success) {
                    showToast('Berhasil keluar 👋', 'success');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 500);
                } else {
                    showToast(result.error || 'Gagal keluar', 'error');
                }
            } catch (error) {
                console.error('Sign out error:', error);
                showToast('Terjadi kesalahan', 'error');
            }
        });
    }
});

// ============================================
// PASSWORD RESET HANDLER
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const forgotLink = document.querySelector('.forgot-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = prompt('Masukkan email Anda untuk reset password:');
            if (!email) return;

            if (typeof window.resetPassword !== 'function') {
                showToast('Error: Fungsi resetPassword tidak tersedia', 'error');
                return;
            }

            try {
                const result = await window.resetPassword(email);
                if (result.success) {
                    showToast('Email reset password telah dikirim! 📧', 'success');
                } else {
                    showToast(result.error || 'Gagal mengirim email reset', 'error');
                }
            } catch (error) {
                console.error('Reset password error:', error);
                showToast('Terjadi kesalahan', 'error');
            }
        });
    }
});

// ============================================
// AUTH STATE MONITOR
// ============================================

// Monitor perubahan auth state
document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah user sudah login
    if (typeof window.getCurrentUser === 'function') {
        window.getCurrentUser().then(user => {
            if (user) {
                console.log('✅ User sudah login:', user.email);
                
                // Jika di halaman login/register, redirect ke dashboard
                const currentPage = window.location.pathname.split('/').pop();
                if (['login.html', 'register.html'].includes(currentPage)) {
                    window.location.href = 'dashboard.html';
                }
            } else {
                console.log('👤 User belum login');
                
                // Jika di halaman protected, redirect ke login
                const protectedPages = ['dashboard.html', 'chat.html', 'finance.html', 
                    'memories.html', 'calendar.html', 'settings.html', 'ai.html'];
                const currentPage = window.location.pathname.split('/').pop();
                if (protectedPages.includes(currentPage)) {
                    window.location.href = 'login.html';
                }
            }
        }).catch(error => {
            console.error('Error checking auth:', error);
        });
    }
});

// ============================================
// EXPOSE FUNCTIONS
// ============================================

// Tidak perlu expose karena sudah di supabase.js

console.log('✅ Auth module loaded successfully');
