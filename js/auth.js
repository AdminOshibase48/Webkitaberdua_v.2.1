// Authentication functions

// Sign up
async function signUp(email, password, fullName, partnerEmail = null) {
    try {
        // Create user
        const { data: { user }, error: signUpError } = await supabaseClient.auth.signUp({
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
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: user.id,
                full_name: fullName,
                email: email,
                status: 'online'
            });

        if (profileError) throw profileError;

        // If partner email provided, link them
        if (partnerEmail) {
            await linkPartner(user.id, partnerEmail);
        }

        // Create relationship
        const { error: relationshipError } = await supabaseClient
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
}

// Sign in
async function signIn(email, password) {
    try {
        const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Update presence
        await updatePresence('online');

        return { success: true, user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out
async function signOut() {
    try {
        await updatePresence('offline');
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// Link partner
async function linkPartner(userId, partnerEmail) {
    try {
        // Find partner by email
        const { data: partner, error: findError } = await supabaseClient
            .from('profiles')
            .select('id')
            .eq('email', partnerEmail)
            .single();

        if (findError || !partner) {
            throw new Error('Partner not found');
        }

        // Update relationship
        const { error: updateError } = await supabaseClient
            .from('relationships')
            .update({ user2_id: partner.id, status: 'active' })
            .eq('user1_id', userId);

        if (updateError) throw updateError;

        // Update partner's relationship
        const { error: partnerUpdateError } = await supabaseClient
            .from('relationships')
            .update({ user2_id: userId, status: 'active' })
            .eq('user1_id', partner.id);

        if (partnerUpdateError) throw partnerUpdateError;

        // Update profiles with partner IDs
        await supabaseClient
            .from('profiles')
            .update({ partner_id: partner.id })
            .eq('id', userId);

        await supabaseClient
            .from('profiles')
            .update({ partner_id: userId })
            .eq('id', partner.id);

        return { success: true };
    } catch (error) {
        console.error('Link partner error:', error);
        return { success: false, error: error.message };
    }
}

// Reset password
async function resetPassword(email) {
    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, error: error.message };
    }
}

// Update password
async function updatePassword(newPassword) {
    try {
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Update password error:', error);
        return { success: false, error: error.message };
    }
}

// Handle auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        getCurrentUser().then(user => {
            if (user) {
                updatePresence('online');
            }
        });
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentUserProfile = null;
        partnerProfile = null;
        relationshipData = null;
        window.location.href = '/login.html';
    }
});

// Export functions
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.linkPartner = linkPartner;
window.resetPassword = resetPassword;
window.updatePassword = updatePassword;

// Handle login form
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            const result = await signIn(email, password);
            if (result.success) {
                window.location.href = '/dashboard.html';
            } else {
                showToast(result.error, 'error');
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('full-name').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const partnerEmail = document.getElementById('partner-email').value || null;

            const result = await signUp(email, password, fullName, partnerEmail);
            if (result.success) {
                showToast('Account created successfully! 🎉', 'success');
                window.location.href = '/dashboard.html';
            } else {
                showToast(result.error, 'error');
            }
        });
    }
});
