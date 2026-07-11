// ============================================
// AUTHENTICATION
// ============================================

// Sign up
window.signUp = async function(email, password, fullName, partnerEmail = null) {
    try {
        const { data: { user }, error: signUpError } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (signUpError) throw signUpError;

        // Create profile
        const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .insert({
                id: user.id,
                full_name: fullName,
                email: email,
                status: 'online'
            });

        if (profileError) throw profileError;

        // Create relationship
        const { error: relationshipError } = await window.supabaseClient
            .from('relationships')
            .insert({
                user1_id: user.id,
                user2_id: null,
                start_date: new Date().toISOString(),
                status: 'pending'
            });

        if (relationshipError) throw relationshipError;

        return { success: true, user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
};

// Sign in
window.signIn = async function(email, password) {
    try {
        const { data: { user }, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        window.currentUser = user;
        await window.updatePresence('online');

        return { success: true, user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
};

// Sign out
window.signOut = async function() {
    try {
        await window.updatePresence('offline');
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        window.currentUser = null;
        window.currentUserProfile = null;
        window.partnerProfile = null;
        window.relationshipData = null;
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
};

// Handle auth state
window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        window.currentUser = session?.user || null;
        if (window.currentUser) {
            window.updatePresence('online');
        }
    } else if (event === 'SIGNED_OUT') {
        window.currentUser = null;
        window.currentUserProfile = null;
        window.partnerProfile = null;
        window.relationshipData = null;
        if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
            window.location.href = 'login.html';
        }
    }
});

// DOM Ready - Auth Forms
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const result = await window.signIn(email, password);
            if (result.success) {
                window.location.href = 'dashboard.html';
            } else {
                window.showToast(result.error, 'error');
            }
        });
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('full-name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const partnerEmail = document.getElementById('partner-email')?.value || null;

            const result = await window.signUp(email, password, fullName, partnerEmail);
            if (result.success) {
                window.showToast('Account created successfully! 🎉', 'success');
                window.location.href = 'dashboard.html';
            } else {
                window.showToast(result.error, 'error');
            }
        });
    }
});

console.log('✅ Auth module loaded');
