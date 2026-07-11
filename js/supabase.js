// ============================================
// SUPABASE CONFIGURATION
// ============================================

// Konfigurasi Supabase - GANTI DENGAN MILIK ANDA
const SUPABASE_URL = 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// Inisialisasi Supabase - PASTIKAN HANYA SEKALI
if (typeof window.supabaseClient === 'undefined') {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Variabel global
window.currentUser = null;
window.currentUserProfile = null;
window.partnerProfile = null;
window.relationshipData = null;

// ============================================
// FUNGSI UTAMA
// ============================================

// Get current user
window.getCurrentUser = async function() {
    try {
        const { data: { user }, error } = await window.supabaseClient.auth.getUser();
        if (error) throw error;
        window.currentUser = user;
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
};

// Get user profile
window.getUserProfile = async function(userId = null) {
    try {
        const id = userId || window.currentUser?.id;
        if (!id) return null;

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        window.currentUserProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
};

// Get partner profile
window.getPartnerProfile = async function() {
    try {
        if (!window.currentUserProfile) return null;
        const partnerId = window.currentUserProfile.partner_id;
        if (!partnerId) return null;

        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .single();

        if (error) throw error;
        window.partnerProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting partner profile:', error);
        return null;
    }
};

// Get relationship
window.getRelationship = async function() {
    try {
        if (!window.currentUser) return null;

        const { data, error } = await window.supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${window.currentUser.id},user2_id.eq.${window.currentUser.id}`)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        window.relationshipData = data;
        return data;
    } catch (error) {
        console.error('Error getting relationship:', error);
        return null;
    }
};

// Update presence
window.updatePresence = async function(status = 'online') {
    try {
        if (!window.currentUser) return;

        const { error } = await window.supabaseClient
            .from('profiles')
            .update({
                status: status,
                last_seen: new Date().toISOString()
            })
            .eq('id', window.currentUser.id);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating presence:', error);
    }
};

// Subscribe to presence
window.subscribeToPresence = function(userId, callback) {
    return window.supabaseClient
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
};

// Check auth
window.checkAuth = async function() {
    const user = await window.getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
};

console.log('✅ Supabase initialized');
