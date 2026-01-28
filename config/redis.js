const redis = require('redis');

// Use socket options for redis@4 to avoid connection issues
const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  },
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err && (err.stack || err));
});

const connectRedis = async () => {
  try {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
    await client.connect();
    console.log(`✅ Connected to Redis at ${host}:${port}`);
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error && (error.stack || error));
    console.warn('⚠️ Falling back to in-memory cache/locks. Set REDIS_HOST/REDIS_PORT or run Redis for full functionality.');
    return false;
  }
};

module.exports = { client, connectRedis };