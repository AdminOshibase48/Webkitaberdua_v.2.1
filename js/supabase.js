// ============================================
// SUPABASE CONFIGURATION - FULL VERSION
// ============================================

// Ambil dari environment variables Vercel atau fallback ke config lokal
const SUPABASE_URL = window.SUPABASE_URL || 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

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
// AUTH FUNCTIONS
// ============================================

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>} User object or null
 */
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

/**
 * Get user profile by ID
 * @param {string} userId - User ID (optional, defaults to current user)
 * @returns {Promise<Object|null>} Profile object or null
 */
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

/**
 * Get partner profile
 * @returns {Promise<Object|null>} Partner profile or null
 */
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

/**
 * Get relationship data
 * @returns {Promise<Object|null>} Relationship object or null
 */
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

/**
 * Update user presence status
 * @param {string} status - 'online', 'offline', or 'away'
 * @returns {Promise<void>}
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
 * Subscribe to presence changes of a user
 * @param {string} userId - User ID to subscribe to
 * @param {Function} callback - Callback function when presence changes
 * @returns {Object} Subscription channel
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
// AUTH OPERATIONS
// ============================================

/**
 * Sign up new user
 * @param {string} email - User email
 * @param {string} password - User password (min 6 chars)
 * @param {string} fullName - User full name
 * @param {string|null} partnerEmail - Partner email (optional)
 * @returns {Promise<Object>} { success, user, error }
 */
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

        // Create profile
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

        // Create user stats
        const { error: statsError } = await supabaseClient
            .from('user_stats')
            .insert({
                user_id: user.id,
                xp: 0,
                level: 1,
                achievements: []
            });

        if (statsError) throw statsError;

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

        if (relationshipError) throw relationshipError;

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
 * Sign in user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} { success, user, error }
 */
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

/**
 * Sign out user
 * @returns {Promise<Object>} { success, error }
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
 * Link partner to user
 * @param {string} userId - Current user ID
 * @param {string} partnerEmail - Partner email to link
 * @returns {Promise<Object>} { success, error }
 */
async function linkPartner(userId, partnerEmail) {
    try {
        // Find partner by email
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

        // Check if already in relationship
        const { data: existingRel, error: relError } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .single();

        if (existingRel) {
            // Update existing relationship
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
            // Create new relationship
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

        // Update profiles with partner IDs
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

        // Add XP for linking partner
        await addXP(userId, 50);

        return { success: true };
    } catch (error) {
        console.error('Link partner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unlink partner
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} { success, error }
 */
async function unlinkPartner(userId) {
    try {
        // Get relationship
        const { data: rel, error: relError } = await supabaseClient
            .from('relationships')
            .select('*')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
            .single();

        if (relError && relError.code !== 'PGRST116') throw relError;

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

        // Get partner
        const partner = await getPartnerProfile();
        
        // Update current user
        await supabaseClient
            .from('profiles')
            .update({ 
                partner_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        // Update partner if exists
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
 * Reset password
 * @param {string} email - User email
 * @returns {Promise<Object>} { success, error }
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
 * Update user password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} { success, error }
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
 * Update user email
 * @param {string} newEmail - New email
 * @returns {Promise<Object>} { success, error }
 */
async function updateEmail(newEmail) {
    try {
        const { error } = await supabaseClient.auth.updateUser({
            email: newEmail
        });

        if (error) throw error;
        
        // Update profile email
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
// PROFILE OPERATIONS
// ============================================

/**
 * Update user profile
 * @param {Object} updates - Profile updates
 * @returns {Promise<Object>} { success, error }
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
        
        // Refresh profile
        await getUserProfile(currentUser.id);
        
        return { success: true };
    } catch (error) {
        console.error('Update profile error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Upload avatar
 * @param {File} file - Avatar image file
 * @returns {Promise<Object>} { success, url, error }
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

        // Update profile with avatar URL
        await updateProfile({ avatar_url: publicUrl });

        return { success: true, url: publicUrl };
    } catch (error) {
        console.error('Upload avatar error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// USER STATS OPERATIONS
// ============================================

/**
 * Get user stats
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object|null>} Stats object or null
 */
async function getUserStats(userId = null) {
    try {
        const id = userId || currentUser?.id;
        if (!id) return null;

        const { data, error } = await supabaseClient
            .from('user_stats')
            .select('*')
            .eq('user_id', id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Create stats if not exists
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

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Get user stats error:', error);
        return null;
    }
}

/**
 * Add XP to user
 * @param {string} userId - User ID
 * @param {number} amount - XP amount to add
 * @returns {Promise<Object>} { success, newXP, newLevel, error }
 */
async function addXP(userId, amount) {
    try {
        const stats = await getUserStats(userId);
        if (!stats) throw new Error('Stats not found');

        const newXP = (stats.xp || 0) + amount;
        const xpPerLevel = 100;
        let newLevel = stats.level || 1;
        let leveledUp = false;

        // Check for level up
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
 * Add achievement to user
 * @param {string} userId - User ID
 * @param {string} achievement - Achievement name
 * @returns {Promise<Object>} { success, error }
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

        // Add XP for achievement
        await addXP(userId, 20);

        return { success: true };
    } catch (error) {
        console.error('Add achievement error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// RELATIONSHIP OPERATIONS
// ============================================

/**
 * Update relationship data
 * @param {Object} updates - Relationship updates
 * @returns {Promise<Object>} { success, error }
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

        // Refresh relationship
        await getRelationship();

        return { success: true };
    } catch (error) {
        console.error('Update relationship error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update love level
 * @param {number} increment - Amount to increment
 * @returns {Promise<Object>} { success, newLevel, error }
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
 * Update relationship streak
 * @param {number} days - Days to add
 * @returns {Promise<Object>} { success, newStreak, error }
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
// MESSAGES OPERATIONS
// ============================================

/**
 * Send a message
 * @param {string} content - Message content
 * @param {string} type - Message type (text, image, gif)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} { success, data, error }
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

        // Add XP for sending message
        await addXP(currentUser.id, 2);

        return { success: true, data };
    } catch (error) {
        console.error('Send message error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get messages with partner
 * @param {number} limit - Number of messages to get
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} { success, data, error }
 */
async function getMessages(limit = 50, offset = 0) {
    try {
        if (!currentUser) {
            currentUser = await getCurrentUser();
        }
        if (!currentUser) throw new Error('Not authenticated');

        const partner = await getPartnerProfile();
        if (!partner) {
            // Get all messages sent by user
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
 * Subscribe to new messages
 * @param {Function} callback - Callback function for new messages
 * @returns {Object} Subscription channel
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

    const channel = supabaseClient
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

    return channel;
}

/**
 * Mark message as read
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} { success, error }
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
 * @param {string} messageId - Message ID
 * @returns {Promise<Object>} { success, error }
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
// NOTIFICATIONS OPERATIONS
// ============================================

/**
 * Send notification
 * @param {string} userId - User ID to send to
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} data - Additional data
 * @returns {Promise<Object>} { success, error }
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
 * Get user notifications
 * @param {number} limit - Number of notifications to get
 * @returns {Promise<Object>} { success, data, error }
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
 * @param {string} notificationId - Notification ID
 * @returns {Promise<Object>} { success, error }
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
 * @returns {Promise<Object>} { success, error }
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
// STORAGE OPERATIONS
// ============================================

/**
 * Upload file to Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @param {File} file - File to upload
 * @returns {Promise<Object>} { success, url, error }
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
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {Promise<Object>} { success, error }
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
 * Subscribe to realtime changes on a table
 * @param {string} table - Table name
 * @param {string} event - Event type (INSERT, UPDATE, DELETE)
 * @param {Function} callback - Callback function
 * @param {string} filter - Optional filter
 * @returns {Object} Subscription channel
 */
function subscribeToTable(table, event, callback, filter = null) {
    let subscription = supabaseClient
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

    return subscription;
}

/**
 * Subscribe to partner's activity
 * @param {Function} callback - Callback function
 * @returns {Object} Subscription channel
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
// AUTH STATE CHANGE LISTENER
// ============================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session?.user || null;
        if (currentUser) {
            updatePresence('online');
            console.log('✅ User signed in:', currentUser.email);
            
            // Notify all listeners
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
        
        // Notify all listeners
        authListeners.forEach(listener => {
            if (listener.onSignOut) listener.onSignOut();
        });
    } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
    }
});

/**
 * Add auth state listener
 * @param {Object} listener - Listener with onSignIn and onSignOut callbacks
 */
function addAuthListener(listener) {
    authListeners.push(listener);
}

/**
 * Remove auth state listener
 * @param {Object} listener - Listener to remove
 */
function removeAuthListener(listener) {
    authListeners = authListeners.filter(l => l !== listener);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize Supabase client and load user data
 * @returns {Promise<Object>} { success, user, error }
 */
async function initSupabase() {
    try {
        const user = await getCurrentUser();
        if (user) {
            await getUserProfile(user.id);
            await getPartnerProfile();
            await getRelationship();
            await updatePresence('online');
        }
        console.log('✅ Supabase initialized');
        return { success: true, user };
    } catch (error) {
        console.error('Supabase init error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// EXPOSE FUNCTIONS
// ============================================

// Supabase client
window.supabaseClient = supabaseClient;

// Auth functions
window.getCurrentUser = getCurrentUser;
window.signUp = signUp;
window.signIn = signIn;
window.signOut = signOut;
window.resetPassword = resetPassword;
window.updatePassword = updatePassword;
window.updateEmail = updateEmail;
window.addAuthListener = addAuthListener;
window.removeAuthListener = removeAuthListener;

// Profile functions
window.getUserProfile = getUserProfile;
window.getPartnerProfile = getPartnerProfile;
window.updateProfile = updateProfile;
window.uploadAvatar = uploadAvatar;
window.updatePresence = updatePresence;
window.subscribeToPresence = subscribeToPresence;

// Relationship functions
window.getRelationship = getRelationship;
window.updateRelationship = updateRelationship;
window.updateLoveLevel = updateLoveLevel;
window.updateStreak = updateStreak;
window.linkPartner = linkPartner;
window.unlinkPartner = unlinkPartner;

// Stats functions
window.getUserStats = getUserStats;
window.addXP = addXP;
window.addAchievement = addAchievement;

// Message functions
window.sendMessage = sendMessage;
window.getMessages = getMessages;
window.subscribeToMessages = subscribeToMessages;
window.markMessageAsRead = markMessageAsRead;
window.deleteMessage = deleteMessage;

// Notification functions
window.sendNotification = sendNotification;
window.getNotifications = getNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// Storage functions
window.uploadFile = uploadFile;
window.deleteFile = deleteFile;

// Realtime functions
window.subscribeToTable = subscribeToTable;
window.subscribeToPartnerActivity = subscribeToPartnerActivity;

// Init function
window.initSupabase = initSupabase;

console.log('✅ Supabase module loaded');
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
console.log(`📊 Supabase Anon Key: ${SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
