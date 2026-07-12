// ============================================
// SUPABASE CONFIGURATION - FULL VERSION
// ============================================

// ============================================
// KONFIGURASI - GANTI DENGAN MILIK ANDA
// ============================================

const SUPABASE_URL = 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// ============================================
// VALIDASI KREDENSIAL
// ============================================

if (SUPABASE_URL === 'https://kqdzhajnkrjhryilaqdu.supabase.co' || SUPABASE_ANON_KEY === 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM') {
    console.warn('⚠️ PERINGATAN: Supabase URL atau Anon Key masih default!');
    console.warn('📝 Ganti dengan kredensial Supabase Anda yang asli!');
    console.warn('📝 Dapatkan dari: https://supabase.com/dashboard/project/_/settings/api');
}

console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('📊 Supabase Anon Key:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

// ============================================
// INISIALISASI SUPABASE CLIENT
// ============================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage,
        storageKey: 'sb-auth-token',
        flowType: 'pkce'
    },
    global: {
        headers: {
            'X-Client-Info': 'ourstory-together-app'
        }
    }
});

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentUserProfile = null;
let partnerProfile = null;
let relationshipData = null;
let authListeners = [];
let isInitialized = false;

// ============================================
// TEST KONEKSI
// ============================================

async function testSupabaseConnection() {
    try {
        console.log('🔍 Testing Supabase connection...');
        console.log('📡 URL:', SUPABASE_URL);
        console.log('🔑 Key:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

        // Test auth
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error('❌ Auth connection failed:', error);
            return { success: false, error: error.message };
        }
        console.log('✅ Auth connection successful');

        // Test database
        const { data: testData, error: dbError } = await supabaseClient
            .from('profiles')
            .select('count')
            .limit(1);

        if (dbError) {
            console.error('❌ Database connection failed:', dbError);
            return { success: false, error: dbError.message };
        }
        console.log('✅ Database connection successful');

        return { success: true };
    } catch (error) {
        console.error('❌ Connection test failed:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

/**
 * Get current authenticated user
 */
async function getCurrentUser() {
    try {
        // Coba dapatkan session dulu
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) {
            console.error('Session error:', sessionError);
            return null;
        }

        if (!session) {
            console.log('No session found');
            return null;
        }

        const { data: { user }, error } = await supabaseClient.auth.getUser();
        if (error) {
            console.error('Get user error:', error);
            // Coba refresh session
            const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
            if (refreshError) {
                console.error('Refresh session error:', refreshError);
                return null;
            }
            if (refreshData.session) {
                currentUser = refreshData.session.user;
                return currentUser;
            }
            return null;
        }
        
        currentUser = user;
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * Sign in user
 */
async function signIn(email, password) {
    try {
        console.log('🔑 Attempting sign in for:', email);
        
        if (!email || !password) {
            throw new Error('Email dan password wajib diisi');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            console.error('Sign in error details:', error);
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Email atau password salah');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Email belum dikonfirmasi. Cek email Anda.');
            } else if (error.message.includes('rate limit')) {
                throw new Error('Terlalu banyak percobaan. Coba lagi nanti.');
            } else {
                throw new Error(error.message);
            }
        }

        if (!data || !data.user) {
            throw new Error('Login gagal, user tidak ditemukan');
        }

        currentUser = data.user;
        console.log('✅ User signed in:', currentUser.email);

        await updatePresence('online');

        return { success: true, user: currentUser };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign up new user
 */
async function signUp(email, password, fullName, partnerEmail = null) {
    try {
        console.log('📝 Attempting sign up for:', email);
        
        if (!email || !password || !fullName) {
            throw new Error('Semua field wajib diisi');
        }
        if (password.length < 6) {
            throw new Error('Password minimal 6 karakter');
        }

        const siteUrl = window.location.origin;
        
        const { data: { user }, error: signUpError } = await supabaseClient.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: {
                    full_name: fullName
                },
                emailRedirectTo: `${siteUrl}/dashboard.html`
            }
        });

        if (signUpError) {
            console.error('Sign up error details:', signUpError);
            if (signUpError.message.includes('already registered')) {
                throw new Error('Email sudah terdaftar');
            } else {
                throw new Error(signUpError.message);
            }
        }

        if (!user) {
            throw new Error('Gagal membuat akun');
        }

        console.log('✅ User created:', user.email);

        // Create profile
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: user.id,
                full_name: fullName,
                email: email.trim(),
                status: 'online',
                created_at: new Date().toISOString()
            });

        if (profileError) {
            console.error('Profile creation error:', profileError);
        }

        // Create user stats
        const { error: statsError } = await supabaseClient
            .from('user_stats')
            .insert({
                user_id: user.id,
                xp: 0,
                level: 1,
                achievements: []
            });

        if (statsError) {
            console.error('Stats creation error:', statsError);
        }

        // Create relationship
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

        if (relationshipError) {
            console.error('Relationship creation error:', relationshipError);
        }

        // Link partner if email provided
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

/**
 * Sign out user
 */
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

/**
 * Reset password
 */
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

/**
 * Update password
 */
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

/**
 * Update email
 */
async function updateEmail(newEmail) {
    try {
        const { error } = await supabaseClient.auth.updateUser({
            email: newEmail
        });

        if (error) throw error;
        
        if (currentUser) {
            await supabaseClient
                .from('profiles')
                .update({ email: newEmail })
                .eq('id', currentUser.id);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Update email error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

/**
 * Get user profile
 */
async function getUserProfile(userId = null) {
    try {
        const id = userId || currentUser?.id;
        if (!id) {
            console.log('No user ID provided');
            return null;
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            console.error('Get profile error:', error);
            return null;
        }

        currentUserProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
}

/**
 * Get partner profile
 */
async function getPartnerProfile() {
    try {
        if (!currentUserProfile) {
            currentUserProfile = await getUserProfile();
        }
        if (!currentUserProfile) {
            console.log('No user profile found');
            return null;
        }
        
        const partnerId = currentUserProfile.partner_id;
        if (!partnerId) {
            console.log('No partner linked');
            return null;
        }

        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();

        if (error) {
            console.error('Get partner profile error:', error);
            return null;
        }

        if (!data) {
            console.log('Partner profile not found for ID:', partnerId);
            return null;
        }

        partnerProfile = data;
        return data;
    } catch (error) {
        console.error('Error getting partner profile:', error);
        return null;
    }
}

/**
 * Update profile
 */
async function updateProfile(updates) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const { error } = await supabaseClient
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);

        if (error) throw error;
        
        await getUserProfile(currentUser.id);
        
        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Upload avatar
 */
async function uploadAvatar(file) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `avatars/${currentUser.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('profiles')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('profiles')
            .getPublicUrl(fileName);

        await updateProfile({ avatar_url: publicUrl });

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Upload avatar error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update presence
 */
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

/**
 * Subscribe to presence
 */
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
// RELATIONSHIP FUNCTIONS
// ============================================

/**
 * Get relationship data
 */
async function getRelationship() {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) {
            console.log('No user found');
            return null;
        }

        const { data, error } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
            .maybeSingle();

        if (error) {
            console.error('Get relationship error:', error);
            return null;
        }

        relationshipData = data;
        return data;
    } catch (error) {
        console.error('Error getting relationship:', error);
        return null;
    }
}

/**
 * Link partner
 */
async function linkPartner(userId, partnerEmail) {
    try {
        console.log('🔗 Linking partner:', partnerEmail);
        
        if (!partnerEmail || partnerEmail.trim() === '') {
            throw new Error('Email partner wajib diisi');
        }

        const { data: partner, error: findError } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .ilike('email', partnerEmail.trim())
            .maybeSingle();

        if (findError) {
            console.error('Find partner error:', findError);
            throw new Error('Error mencari partner: ' + findError.message);
        }

        if (!partner) {
            throw new Error('Partner tidak ditemukan. Pastikan mereka sudah mendaftar dan email benar.');
        }

        console.log('✅ Partner found:', partner.full_name, partner.id);

        if (partner.id === userId) {
            throw new Error('Tidak bisa menghubungkan dengan diri sendiri');
        }

        // Cek relationship existing
        const { data: existingRel, error: relError } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .maybeSingle();

        if (relError && relError.code !== 'PGRST116') {
            console.error('Check relationship error:', relError);
        }

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
            const { error: insertError } = await supabaseClient
                .from('relationships')
                .insert({
                    user1_id: userId,
                    user2_id: partner.id,
                    status: 'active',
                    start_date: new Date().toISOString(),
                    love_level: 1,
                    streak_days: 0
                });

            if (insertError) {
                console.error('Create relationship error:', insertError);
                throw new Error('Gagal membuat hubungan: ' + insertError.message);
            }
        }

        // Update profiles
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

        console.log('✅ Partner linked successfully!');
        return { success: true, partner };
    } catch (error) {
        console.error('Link partner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unlink partner
 */
async function unlinkPartner(userId) {
    try {
        const { data: rel } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .maybeSingle();

        if (rel) {
            await supabaseClient
                .from('relationships')
                .update({ 
                    status: 'inactive', 
                    user2_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', rel.id);
        }

        const partner = await getPartnerProfile();
        
        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (partner) {
            await supabaseClient
                .from('profiles')
                .update({ 
                    partner_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', partner.id);
        }

        partnerProfile = null;
        relationshipData = null;

        return { success: true };
    } catch (error) {
        console.error('Unlink partner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update relationship
 */
async function updateRelationship(updates) {
    try {
        if (!relationshipData) {
            await getRelationship();
        }
        if (!relationshipData) throw new Error('Relationship not found');

        const { error } = await supabaseClient
            .from('relationships')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', relationshipData.id);

        if (error) throw error;

        await getRelationship();

        return { success: true };
    } catch (error) {
        console.error('Update relationship error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update love level
 */
async function updateLoveLevel(increment = 1) {
    try {
        if (!relationshipData) {
            await getRelationship();
        }
        if (!relationshipData) throw new Error('Relationship not found');

        const currentLevel = relationshipData.love_level || 1;
        const newLevel = Math.min(currentLevel + increment, 100);

        await updateRelationship({ love_level: newLevel });

        return { success: true, newLevel };
    } catch (error) {
        console.error('Update love level error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update streak
 */
async function updateStreak(days = 1) {
    try {
        if (!relationshipData) {
            await getRelationship();
        }
        if (!relationshipData) throw new Error('Relationship not found');

        const currentStreak = relationshipData.streak_days || 0;
        const newStreak = currentStreak + days;

        await updateRelationship({ streak_days: newStreak });

        return { success: true, newStreak };
    } catch (error) {
        console.error('Update streak error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// USER STATS FUNCTIONS
// ============================================

/**
 * Get user stats
 */
async function getUserStats(userId = null) {
    try {
        const id = userId || currentUser?.id;
        if (!id) return null;

        const { data, error } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) {
            const { data: newStats, error: createError } = await supabaseClient
                .from('user_stats')
                .insert({
                    user_id: id,
                    xp: 0,
                    level: 1,
                    achievements: []
                })
                .select()
                .single();

            if (createError) throw createError;
            return newStats;
        }

        return data;
    } catch (error) {
        console.error('Get user stats error:', error);
        return null;
    }
}

/**
 * Add XP
 */
async function addXP(userId, amount) {
    try {
        const stats = await getUserStats(userId);
        if (!stats) throw new Error('Stats not found');

        const newXP = (stats.xp || 0) + amount;
        const xpPerLevel = 100;
        let newLevel = stats.level || 1;
        let leveledUp = false;

        while (newXP >= xpPerLevel * newLevel) {
            newLevel++;
            leveledUp = true;
        }

        const { error } = await supabaseClient
            .from('user_stats')
            .update({
                xp: newXP,
                level: newLevel,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;

        return { 
            success: true, 
            xp: newXP, 
            level: newLevel,
            leveledUp: leveledUp
        };
    } catch (error) {
        console.error('Add XP error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add achievement
 */
async function addAchievement(userId, achievement) {
    try {
        const stats = await getUserStats(userId);
        if (!stats) throw new Error('Stats not found');

        const achievements = stats.achievements || [];
        if (achievements.includes(achievement)) {
            return { success: true, alreadyHas: true };
        }

        achievements.push(achievement);

        const { error } = await supabaseClient
            .from('user_stats')
            .update({
                achievements: achievements,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;

        await addXP(userId, 20);

        return { success: true };
    } catch (error) {
        console.error('Add achievement error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// MESSAGE FUNCTIONS
// ============================================

/**
 * Send message
 */
async function sendMessage(content, type = 'text', metadata = {}) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const partner = await getPartnerProfile();
        if (!partner) throw new Error('No partner linked');

        const message = {
            sender_id: currentUser.id,
            receiver_id: partner.id,
            content: content,
            type: type,
            status: 'sent',
            metadata: metadata,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabaseClient
            .from('messages')
            .insert(message)
            .select()
            .single();

        if (error) throw error;

        await addXP(currentUser.id, 2);

        return { success: true, data };
    } catch (error) {
        console.error('Send message error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get messages
 */
async function getMessages(limit = 50, offset = 0) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const partner = await getPartnerProfile();
        if (!partner) {
            const { data, error } = await supabaseClient
                .from('messages')
                .select('*')
                .eq('sender_id', currentUser.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return { success: true, data: data.reverse() };
        }

        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return { success: true, data: data.reverse() };
    } catch (error) {
        console.error('Get messages error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Subscribe to messages
 */
function subscribeToMessages(callback) {
    if (!currentUser) {
        getCurrentUser().then(() => {
            if (currentUser) {
                subscribeToMessages(callback);
            }
        });
        return null;
    }

    return supabaseClient
        .channel(`messages-${currentUser.id}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${currentUser.id}`
            },
            (payload) => {
                if (callback) callback(payload.new);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${currentUser.id}`
            },
            (payload) => {
                if (callback) callback(payload.new);
            }
        )
        .subscribe();
}

/**
 * Mark message as read
 */
async function markMessageAsRead(messageId) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ 
                status: 'read',
                read_at: new Date().toISOString()
            })
            .eq('id', messageId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Mark message as read error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete message
 */
async function deleteMessage(messageId) {
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ status: 'deleted' })
            .eq('id', messageId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete message error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send notification
 */
async function sendNotification(userId, type, title, message, data = null) {
    try {
        const notification = {
            user_id: userId,
            type: type,
            title: title,
            message: message,
            data: data,
            read: false,
            created_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('notifications')
            .insert(notification);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Send notification error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get notifications
 */
async function getNotifications(limit = 50) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const { data, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Get notifications error:', error);
        return { success: false, error: error.message, data: [] };
    }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ 
                read: true,
                read_at: new Date().toISOString()
            })
            .eq('id', notificationId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Mark notification as read error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead() {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const { error } = await supabaseClient
            .from('notifications')
            .update({ 
                read: true,
                read_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id)
            .eq('read', false);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// STORAGE FUNCTIONS
// ============================================

/**
 * Upload file to Supabase Storage
 */
async function uploadFile(bucket, path, file) {
    try {
        const { error: uploadError } = await supabaseClient.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Upload file error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete file from Supabase Storage
 */
async function deleteFile(bucket, path) {
    try {
        const { error } = await supabaseClient.storage
            .from(bucket)
            .remove([path]);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Delete file error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

/**
 * Subscribe to table changes
 */
function subscribeToTable(table, event, callback, filter = null) {
    return supabaseClient
        .channel(`table-${table}-${Date.now()}`)
        .on(
            'postgres_changes',
            {
                event: event,
                schema: 'public',
                table: table,
                filter: filter
            },
            (payload) => {
                if (callback) callback(payload);
            }
        )
        .subscribe();
}

/**
 * Subscribe to partner activity
 */
function subscribeToPartnerActivity(callback) {
    if (!currentUser) {
        getCurrentUser().then(() => {
            if (currentUser) {
                subscribeToPartnerActivity(callback);
            }
        });
        return null;
    }

    return supabaseClient
        .channel(`partner-${currentUser.id}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=ne.${currentUser.id}`
            },
            (payload) => {
                if (callback) callback(payload.new);
            }
        )
        .subscribe();
}

// ============================================
// AUTH STATE CHANGE HANDLER
// ============================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth state changed:', event);
    
    if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        if (currentUser) {
            updatePresence('online');
            console.log('✅ User signed in:', currentUser.email);
            
            authListeners.forEach(listener => {
                if (listener.onSignIn) listener.onSignIn(currentUser);
            });
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        currentUserProfile = null;
        partnerProfile = null;
        relationshipData = null;
        console.log('👋 User signed out');
        
        authListeners.forEach(listener => {
            if (listener.onSignOut) listener.onSignOut();
        });
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
    } else if (event === 'USER_UPDATED') {
        console.log('👤 User updated');
        if (session?.user) {
            currentUser = session.user;
        }
    }
});

// ============================================
// AUTH LISTENERS
// ============================================

function addAuthListener(listener) {
    authListeners.push(listener);
}

function removeAuthListener(listener) {
    authListeners = authListeners.filter(l => l !== listener);
}

// ============================================
// INITIALIZATION
// ============================================

async function initSupabase() {
    try {
        const user = await getCurrentUser();
        if (user) {
            await getUserProfile(user.id);
            await getPartnerProfile();
            await getRelationship();
            await updatePresence('online');
        }
        isInitialized = true;
        console.log('✅ Supabase initialized');
        return { success: true, user };
    } catch (error) {
        console.error('Supabase init error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// AUTO TEST KONEKSI
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        const result = await testSupabaseConnection();
        if (!result.success) {
            console.warn('⚠️ Supabase connection issue detected');
            if (SUPABASE_URL === 'https://your-project-id.supabase.co') {
                console.error('❌ Please update SUPABASE_URL in supabase.js');
            }
            if (SUPABASE_ANON_KEY === 'your-anon-key') {
                console.error('❌ Please update SUPABASE_ANON_KEY in supabase.js');
            }
        }
    }, 1000);
});

// ============================================
// EXPOSE FUNCTIONS
// ============================================

// Client
window.supabaseClient = supabaseClient;

// Auth
window.getCurrentUser = getCurrentUser;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.resetPassword = resetPassword;
window.updatePassword = updatePassword;
window.updateEmail = updateEmail;
window.addAuthListener = addAuthListener;
window.removeAuthListener = removeAuthListener;

// Profile
window.getUserProfile = getUserProfile;
window.getPartnerProfile = getPartnerProfile;
window.updateProfile = updateProfile;
window.uploadAvatar = uploadAvatar;
window.updatePresence = updatePresence;
window.subscribeToPresence = subscribeToPresence;

// Relationship
window.getRelationship = getRelationship;
window.updateRelationship = updateRelationship;
window.updateLoveLevel = updateLoveLevel;
window.updateStreak = updateStreak;
window.linkPartner = linkPartner;
window.unlinkPartner = unlinkPartner;

// Stats
window.getUserStats = getUserStats;
window.addXP = addXP;
window.addAchievement = addAchievement;

// Messages
window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.subscribeToMessages = subscribeToMessages;
window.markMessageAsRead = markMessageAsRead;
window.deleteMessage = deleteMessage;

// Notifications
window.sendNotification = sendNotification;
window.getNotifications = getNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// Storage
window.uploadFile = uploadFile;
window.deleteFile = deleteFile;

// Realtime
window.subscribeToTable = subscribeToTable;
window.subscribeToPartnerActivity = subscribeToPartnerActivity;

// Init & Test
window.initSupabase = initSupabase;
window.testSupabaseConnection = testSupabaseConnection;

console.log('✅ Supabase module loaded');
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
console.log(`📊 Supabase Anon Key: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
