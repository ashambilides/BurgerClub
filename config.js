// ============================================
// BOTMC CONFIGURATION
// Fill in your credentials below
// ============================================

const CONFIG = {
    // Supabase (free tier)
    // 1. Go to https://supabase.com and create a free project
    // 2. Go to Settings > API and copy the URL and anon key
    SUPABASE_URL: 'https://yezihsgtccwitfwgwudv.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_QL9pwpFDUqF5QHhSytvVmQ_Jkv3JvQU',

    // Admin password hash (default: "password")
    // To change: use the admin panel's Settings tab, or
    // generate a new hash at the browser console: await hashPassword('yournewpassword')
    ADMIN_PASSWORD_HASH: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',

    // Map defaults (NYC centered)
    MAP_CENTER: [40.7128, -74.0060],
    MAP_ZOOM: 12,
};
