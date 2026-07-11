// Supabase Configuration
const SUPABASE_URL = 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Store for current user
let currentUser = null;
let currentUserProfile = null;
let partnerProfile = null;
let relationshipData = null;

// Get current user
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        currentUser = user;
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

// Get user profile
async function getUserProfile(userId = null) {
    try {
        const id = userId || currentUser?.id;
        if (!id) return null;

        const { data, error } = await supabase
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

// Get partner profile
async function getPartnerProfile() {
    try {
        if (!currentUserProfile) return null;
        const partnerId = currentUserProfile.partner_id;
        if (!partnerId) return null;

        const { data, error } = await supabase
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

// Check if user is authenticated
async function checkAuth() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Get relationship data
async function getRelationship() {
    try {
        if (!currentUser) return null;

        const { data, error } = await supabase
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

// Update user presence
async function updatePresence(status = 'online') {
    try {
        if (!currentUser) return;

        const { error } = await supabase
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

// Subscribe to presence changes
function subscribeToPresence(userId, callback) {
    return supabase
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

// Export functions
window.supabaseClient = supabase;
window.getCurrentUser = getCurrentUser;
window.getUserProfile = getUserProfile;
window.getPartnerProfile = getPartnerProfile;
window.checkAuth = checkAuth;
window.getRelationship = getRelationship;
window.updatePresence = updatePresence;
window.subscribeToPresence = subscribeToPresence;
