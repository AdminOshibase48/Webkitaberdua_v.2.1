// ============================================
// SUPABASE CONFIGURATION - FIXED VERSION
// ============================================

// ============================================
// STEP 1: DEFINE CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

console.log('🔗 Supabase URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('🔑 Supabase Anon Key:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

// ============================================
// STEP 2: INITIALIZE CLIENT
// ============================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase client initialized');

// ============================================
// STEP 3: STATE
// ============================================

let currentUser = null;
let currentUserProfile = null;
let partnerProfile = null;
let relationshipData = null;

// ============================================
// STEP 4: AUTH FUNCTIONS
// ============================================

async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            // Jika session missing, coba refresh
            if (error.message.includes('Auth session missing')) {
                console.log('🔄 Session missing, trying to refresh...');
                const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
                if (sessionError) throw sessionError;
                if (sessionData?.session) {
                    const { data: { user: refreshedUser }, error: refreshError } = await supabaseClient.auth.getUser();
                    if (refreshError) throw refreshError;
                    currentUser = refreshedUser;
                    return refreshedUser;
                }
            }
            throw error;
        }
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

        if (error) {
            if (error.code === 'PGRST116') {
                // Profile belum ada, coba create
                console.log('📝 Profile not found, creating...');
                const user = await getCurrentUser();
                if (user) {
                    const { data: newProfile, error: createError } = await supabaseClient
                        .from('profiles')
                        .insert({
                            id: user.id,
                            full_name: user.user_metadata?.full_name || user.email,
                            email: user.email,
                            status: 'online',
                            created_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (createError) {
                        console.error('❌ Failed to create profile:', createError);
                        // Jika RLS error, beri tahu user
                        if (createError.code === '42501') {
                            throw new Error('RLS_ERROR: Please run RLS fix SQL in Supabase dashboard');
                        }
                        return null;
                    }
                    currentUserProfile = newProfile;
                    return newProfile;
                }
                return null;
            }
            throw error;
        }
        
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
// STEP 5: AUTH OPERATIONS - FIXED
// ============================================

async function signUp(email, password, fullName, partnerEmail = null) {
    try {
        console.log('📝 Signing up:', email);
        
        const siteUrl = window.location.origin;
        
        // STEP 1: Create user
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

        console.log('✅ User created:', user.id);

        // STEP 2: Create profile - COBA LANGSUNG
        try {
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .insert({
                    id: user.id,
                    full_name: fullName,
                    email: email,
                    status: 'online',
                    created_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('❌ Profile creation error:', profileError);
                
                // Jika RLS error, beri pesan jelas
                if (profileError.code === '42501') {
                    throw new Error('⚠️ RLS Policy Error: Silakan jalankan SQL fix RLS di Supabase Dashboard terlebih dahulu!');
                }
                throw profileError;
            }
        } catch (profileError) {
            // Jika profile gagal, kita tetap lanjut tapi dengan warning
            console.warn('⚠️ Profile creation failed, but user created:', profileError);
            // Beri tahu user bahwa profile perlu dibuat manual
            return { 
                success: true, 
                user: user,
                warning: 'Profile creation failed. Please check Supabase RLS policies.',
                error: profileError.message
            };
        }

        console.log('✅ Profile created');

        // STEP 3: Create user stats
        try {
            await supabaseClient
                .from('user_stats')
                .insert({
                    user_id: user.id,
                    xp: 0,
                    level: 1,
                    achievements: []
                });
        } catch (statsError) {
            console.warn('⚠️ Stats creation failed:', statsError);
        }

        // STEP 4: Create relationship
        try {
            await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: user.id,
                    user2_id: null,
                    start_date: new Date().toISOString(),
                    status: 'pending',
                    love_level: 1,
                    streak_days: 0
                });
        } catch (relError) {
            console.warn('⚠️ Relationship creation failed:', relError);
        }

        // STEP 5: Link partner
        if (partnerEmail) {
            try {
                await linkPartner(user.id, partnerEmail);
            } catch (linkError) {
                console.warn('⚠️ Partner linking failed:', linkError);
            }
        }

        currentUser = user;
        return { success: true, user };
        
    } catch (error) {
        console.error('❌ Sign up error:', error);
        
        // Pesan error yang jelas
        let errorMessage = error.message;
        if (error.message.includes('RLS')) {
            errorMessage = '⚠️ Silakan jalankan SQL fix RLS di Supabase Dashboard terlebih dahulu!\n\n' + error.message;
        }
        
        return { success: false, error: errorMessage };
    }
}

async function signIn(email, password) {
    try {
        console.log('🔑 Signing in:', email);
        
        const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        if (!user) throw new Error('Login failed');

        currentUser = user;
        
        // Coba dapatkan profile
        await getUserProfile(user.id);
        
        await updatePresence('online');

        console.log('✅ User signed in:', user.email);
        return { success: true, user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

async function signOut() {
    try {
        console.log('👋 Signing out...');
        
        await updatePresence('offline');
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentUserProfile = null;
        partnerProfile = null;
        relationshipData = null;
        
        console.log('✅ Signed out');
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

        const { data: existingRel } = await supabaseClient
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
// STEP 6: AUTH STATE CHANGE LISTENER
// ============================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Auth state changed:', event);
    
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
// STEP 7: GET SESSION ON LOAD
// ============================================

// Cek session saat load
(async function initSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (session?.user) {
            currentUser = session.user;
            console.log('✅ Session found:', currentUser.email);
            await getUserProfile(currentUser.id);
        } else {
            console.log('👤 No active session');
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
})();

// ============================================
// STEP 8: EXPOSE FUNCTIONS
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

console.log('✅ Supabase module loaded successfully');
console.log('📋 Functions exported:');
console.log('  - signUp:', typeof window.signUp);
console.log('  - signIn:', typeof window.signIn);
console.log('  - signOut:', typeof window.signOut);
