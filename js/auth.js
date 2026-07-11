// ============================================
// AUTH HANDLERS
// ============================================

// Handle login form
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;

            if (!email || !password) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            const result = await signIn(email, password);
            if (result.success) {
                showToast('Welcome back! 💕', 'success');
                window.location.href = 'dashboard.html';
            } else {
                showToast(result.error || 'Login failed', 'error');
            }
        });
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('full-name')?.value;
            const email = document.getElementById('email')?.value;
            const password = document.getElementById('password')?.value;
            const partnerEmail = document.getElementById('partner-email')?.value || null;

            if (!fullName || !email || !password) {
                showToast('Please fill in all fields', 'error');
                return;
            }

            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
            }

            const result = await signUp(email, password, fullName, partnerEmail);
            if (result.success) {
                showToast('Account created successfully! 🎉', 'success');
                window.location.href = 'dashboard.html';
            } else {
                showToast(result.error || 'Registration failed', 'error');
            }
        });
    }

    // Sign out button
    const signOutBtn = document.getElementById('sign-out');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            const result = await signOut();
            if (result.success) {
                showToast('Signed out 👋', 'success');
                window.location.href = 'index.html';
            } else {
                showToast('Failed to sign out', 'error');
            }
        });
    }

    // Password reset
    const forgotLink = document.querySelector('.forgot-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Enter your email to reset password:');
            if (email) {
                const result = await resetPassword(email);
                if (result.success) {
                    showToast('Password reset email sent! 📧', 'success');
                } else {
                    showToast(result.error || 'Failed to send reset email', 'error');
                }
            }
        });
    }
});

// ============================================
// AUTH STATE CHANGE HANDLER
// ============================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        if (currentUser) {
            updatePresence('online');
            console.log('✅ User signed in:', currentUser.email);
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentUserProfile = null;
        partnerProfile = null;
        relationshipData = null;
        console.log('👋 User signed out');
    }
});

console.log('✅ Auth module loaded');
