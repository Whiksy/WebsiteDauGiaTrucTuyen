const { createClient } = require('redis');
const { getConfig } = require('./index');
const { getLogger } = require('../logger');

const logger = getLogger('Redis');
const config = getConfig();

let redisClient = null;

async function connectRedis() {
  try {
    const redisConfig = config.getRedisConfig();
    
    let url = `redis://${redisConfig.host}:${redisConfig.port}`;
    if (redisConfig.password) {
      url = `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`;
    }
    
    redisClient = createClient({ url });

    redisClient.on('error', (err) => logger.error('❌ Lỗi Client Redis', err));
    redisClient.on('connect', () => logger.info('📌 Đang kết nối tới Redis...'));
    redisClient.on('ready', () => logger.info(`✅ Redis đã sẵn sàng tại ${redisConfig.host}:${redisConfig.port}`));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('❌ Không thể kết nối tới Redis. Hệ thống sẽ tiếp tục không có Cache', error);
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };