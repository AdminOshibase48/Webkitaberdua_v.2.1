// ============================================
// SUPABASE CONFIGURATION - FIXED
// ============================================

// Ambil dari environment variables Vercel atau fallback
// PASTIKAN URL DAN KEY BENAR
const SUPABASE_URL = window.SUPABASE_URL || 'https://kqdzhajnkrjhryilaqdu.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM';

// VALIDASI - Cek apakah URL dan Key terisi
if (SUPABASE_URL === 'https://kqdzhajnkrjhryilaqdu.supabase.co' || SUPABASE_ANON_KEY === 'sb_publishable_f7R-mvQIWT5wKgdBGYyi8w_6vfH2WbM') {
    console.warn('⚠️ PERINGATAN: Supabase URL atau Anon Key masih default!');
    console.warn('📝 Ganti dengan kredensial Supabase Anda yang asli!');
    showToast('⚠️ Konfigurasi Supabase belum diatur!', 'error', 5000);
}

console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('📊 Supabase Anon Key:', SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

// Inisialisasi Supabase client dengan opsi tambahan
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: localStorage,
        storageKey: 'sb-auth-token'
    },
    global: {
        headers: {
            'X-Client-Info': 'ourstory-app'
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
// AUTH FUNCTIONS - FIXED
// ============================================

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>} User object or null
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
 * Sign in user - FIXED
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} { success, user, error }
 */
async function signIn(email, password) {
    try {
        console.log('🔑 Attempting sign in for:', email);
        
        // Validasi input
        if (!email || !password) {
            throw new Error('Email dan password wajib diisi');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email.trim(),
            password: password
        });

        if (error) {
            console.error('Sign in error details:', error);
            // Handle error spesifik
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Email atau password salah');
            } else if (error.message.includes('Email not confirmed')) {
                throw new Error('Email belum dikonfirmasi. Cek email Anda.');
            } else {
                throw new Error(error.message);
            }
        }

        if (!data || !data.user) {
            throw new Error('Login gagal, user tidak ditemukan');
        }

        currentUser = data.user;
        console.log('✅ User signed in:', currentUser.email);

        // Update presence
        await updatePresence('online');

        return { success: true, user: currentUser };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign up new user - FIXED
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} fullName - User full name
 * @param {string|null} partnerEmail - Partner email (optional)
 * @returns {Promise<Object>} { success, user, error }
 */
async function signUp(email, password, fullName, partnerEmail = null) {
    try {
        console.log('📝 Attempting sign up for:', email);
        
        // Validasi input
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
            // Lanjutkan meskipun profile error, user sudah dibuat
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
