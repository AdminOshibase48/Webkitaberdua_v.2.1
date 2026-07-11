// ============================================
// SUPABASE CONFIGURATION - VERCEL READY
// ============================================

// Ambil dari environment variables Vercel dengan fallback
const SUPABASE_URL = process?.env?.SUPABASE_URL || 
                     window?.SUPABASE_URL || 
                     'https://kqdzhajnkrjhryilaqdu.supabase.co';

const SUPABASE_ANON_KEY = process?.env?.SUPABASE_ANON_KEY || 
                          window?.SUPABASE_ANON_KEY || 
                          'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// Log untuk debugging
console.log('🔗 Supabase URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('🔑 Supabase Anon Key:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

// Inisialisasi Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentUserProfile = null;
let partnerProfile = null;
let relationshipData = null;
let authListeners = [];

// ============================================
// AUTH FUNCTIONS - (Sama seperti sebelumnya)
// ============================================

async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) throw error;
        currentUser = user;
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

async function getUserProfile(userId = null) {
    try {
        const id = userId || currentUser?.id;
        if (!id) return null;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        currentUserProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
}

async function getPartnerProfile() {
    try {
        if (!currentUserProfile) {
            currentUserProfile = await getUserProfile();
        }
        if (!currentUserProfile) return null;
        
        const partnerId = currentUserProfile.partner_id;
        if (!partnerId) return null;

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .single();

        if (error) throw error;
        partnerProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting partner profile:', error);
        return null;
    }
}

async function getRelationship() {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) return null;

        const { data, error } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        relationshipData = data;
        return data;
    } catch (error) {
        console.error('Error getting relationship:', error);
        return null;
    }
}

async function updatePresence(status = 'online') {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) return;

        const { error } = await supabaseClient
            .from('profiles')
            .update({
                status: status,
                last_seen: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating presence:', error);
    }
}

function subscribeToPresence(userId, callback) {
    if (!userId) return null;
    
    return supabaseClient
        .channel(`presence-${userId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`
            },
            (payload) => {
                if (callback) callback(payload.new);
            }
        )
        .subscribe();
}

// ============================================
// AUTH OPERATIONS
// ============================================

async function signUp(email, password, fullName, partnerEmail = null) {
    try {
        const siteUrl = window.location.origin;
        
        const { data: { user }, error: signUpError } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                },
                emailRedirectTo: `${siteUrl}/dashboard.html`
            }
        });

        if (signUpError) throw signUpError;
        if (!user) throw new Error('User creation failed');

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: user.id,
                full_name: fullName,
                email: email,
                status: 'online',
                created_at: new Date().toISOString()
            });

        if (profileError) throw profileError;

        const { error: statsError } = await supabaseClient
            .from('user_stats')
            .insert({
                user_id: user.id,
                xp: 0,
                level: 1,
                achievements: []
            });

        if (statsError) throw statsError;

        const { error: relationshipError } = await supabaseClient
            .from('relationships')
            .insert({
                user1_id: user.id,
                user2_id: null,
                start_date: new Date().toISOString(),
                status: 'pending',
                love_level: 1,
                streak_days: 0
            });

        if (relationshipError) throw relationshipError;

        if (partnerEmail) {
            await linkPartner(user.id, partnerEmail);
        }

        currentUser = user;
        return { success: true, user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: error.message };
    }
}

async function signIn(email, password) {
    try {
        const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!user) throw new Error('Login failed');

        currentUser = user;
        await updatePresence('online');

        return { success: true, user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function signOut() {
    try {
        await updatePresence('offline');
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentUserProfile = null;
        partnerProfile = null;
        relationshipData = null;
        
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

async function linkPartner(userId, partnerEmail) {
    try {
        const { data: partner, error: findError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .eq('email', partnerEmail)
            .single();

        if (findError || !partner) {
            throw new Error('Partner not found. Make sure they have registered.');
        }

        if (partner.id === userId) {
            throw new Error('Cannot link to yourself');
        }

        const { data: existingRel, error: relError } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .single();

        if (existingRel) {
            if (existingRel.user1_id === userId) {
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
            await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: userId,
                    user2_id: partner.id,
                    status: 'active',
                    start_date: new Date().toISOString(),
                    love_level: 1,
                    streak_days: 0
                });
        }

        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: partner.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: userId,
                updated_at: new Date().toISOString()
            })
            .eq('id', partner.id);

        await addXP(userId, 50);

        return { success: true };
    } catch (error) {
        console.error('Link partner error:', error);
        return { success: false, error: error.message };
    }
}

async function resetPassword(email) {
    try {
        const siteUrl = window.location.origin;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/reset-password.html`
        });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Reset password error:', error);
        return { success: false, error: error.message };
    }
}

async function addXP(userId, amount) {
    try {
        const { data: stats, error: statsError } = await supabaseClient
            .from('user_stats')
            .select('xp, level')
            .eq('user_id', userId)
            .single();

        if (statsError && statsError.code === 'PGRST116') {
            await supabaseClient
                .from('user_stats')
                .insert({
                    user_id: userId,
                    xp: amount,
                    level: 1,
                    achievements: []
                });
            return { success: true };
        }

        if (statsError) throw statsError;

        const newXP = (stats.xp || 0) + amount;
        const xpPerLevel = 100;
        let newLevel = stats.level || 1;

        while (newXP >= xpPerLevel * newLevel) {
            newLevel++;
        }

        await supabaseClient
            .from('user_stats')
            .update({
                xp: newXP,
                level: newLevel,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        return { success: true, xp: newXP, level: newLevel };
    } catch (error) {
        console.error('Add XP error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// AUTH STATE CHANGE LISTENER
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

// ============================================
// EXPOSE FUNCTIONS
// ============================================

window.supabaseClient = supabaseClient;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.getPartnerProfile = getPartnerProfile;
window.getRelationship = getRelationship;
window.updatePresence = updatePresence;
window.subscribeToPresence = subscribeToPresence;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.linkPartner = linkPartner;
window.resetPassword = resetPassword;
window.addXP = addXP;

console.log('✅ Supabase module loaded');
console.log(`🌐 Environment: ${window.location.hostname}`);
