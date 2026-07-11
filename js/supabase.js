// ============================================
// SUPABASE CONFIGURATION
// ============================================

// Konfigurasi Supabase - GANTI DENGAN MILIK ANDA
const SUPABASE_URL = 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// Inisialisasi Supabase client - HANYA SEKALI
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentUser = null;
let currentUserProfile = null;
let partnerProfile = null;
let relationshipData = null;

// ============================================
// AUTH FUNCTIONS
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
        return data;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
}

async function getPartnerProfile() {
    try {
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
    return supabaseClient
        .channel('presence')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`
            },
            (payload) => {
                callback(payload.new);
            }
        )
        .subscribe();
}

// ============================================
// AUTH OPERATIONS
// ============================================

async function signUp(email, password, fullName, partnerEmail = null) {
    try {
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

        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: user.id,
                full_name: fullName,
                email: email,
                status: 'online'
            });

        if (profileError) throw profileError;

        if (partnerEmail) {
            await linkPartner(user.id, partnerEmail);
        }

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

async function signIn(email, password) {
    try {
        const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

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
            .select('id')
            .eq('email', partnerEmail)
            .single();

        if (findError || !partner) {
            throw new Error('Partner not found');
        }

        await supabaseClient
            .from('relationships')
            .update({ user2_id: partner.id, status: 'active' })
            .eq('user1_id', userId);

        await supabaseClient
            .from('relationships')
            .update({ user2_id: userId, status: 'active' })
            .eq('user1_id', partner.id);

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

console.log('✅ Supabase module loaded');
