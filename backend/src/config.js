export function configFromEnv(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origins = (env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (production && (!env.DATABASE_URL || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.REDIS_URL || !origins.length)) {
    throw new Error('Production requires DATABASE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, REDIS_URL and CORS_ORIGINS');
  }
  return {
    production,
    port: Number(env.PORT || 8080),
    databaseUrl: env.DATABASE_URL || '',
    poolMax: Math.max(1, Math.min(20, Number(env.DATABASE_POOL_MAX || 8))),
    supabaseUrl: env.SUPABASE_URL || '',
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY || '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    redisUrl: env.REDIS_URL || '',
    origins,
    rateLimit: Math.max(10, Number(env.RATE_LIMIT_PER_MINUTE || 90)),
    mediaBucket: env.MEDIA_BUCKET || 'barberos-images',
    whatsapp: {
      enabled: env.WHATSAPP_SEND_ENABLED === 'true',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      graphVersion: env.WHATSAPP_GRAPH_VERSION || 'v23.0',
      templateName: env.WHATSAPP_TEMPLATE_NAME || 'barberos_booking_confirmation',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE || 'es',
    },
  };
}
