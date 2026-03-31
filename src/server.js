require('dotenv').config();

const mysql = require('mysql2/promise');
const { getConfig } = require('./config');
const { getLogger } = require('./logger');
const { RepositoryFactory } = require('./repositories/RepositoryFactory');
const { connectRedis } = require('./config/redis');
const { getSchedulerService } = require('./services/SchedulerService');
const { createApp, createServer } = require('./app');

const config = getConfig();
const logger = getLogger('Máy Chủ');

/**
 * Đảm bảo Database đã tồn tại trước khi kết nối
 */
async function ensureDatabaseExists() {
  try {
    const dbConfig = config.getDatabaseConfig();
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.end();
    logger.info(`✅ Đã kiểm tra/khởi tạo CSDL: ${dbConfig.database} (tại Laragon)`);
  } catch (error) {
    logger.error('❌ Lỗi khi khởi tạo CSDL', error);
  }
}

/**
 * Khởi động máy chủ
 */
async function start() {
  try {
    logger.info('🚀 Bắt đầu máy chủ hệ thống đấu giá...');
    logger.info(`Môi trường: ${config.get('NODE_ENV')}`);
    logger.info(`Cổng: ${config.get('PORT')}`);

    // Tự động tạo DB nếu chưa có
    await ensureDatabaseExists();

    // Kết nối cơ sở dữ liệu
    logger.info('📊 Kết nối cơ sở dữ liệu...');
    const db = RepositoryFactory.getDatabaseManager();
    await db.connect();

    // Tự động tạo tài khoản Admin
    try {
      const userRepo = RepositoryFactory.getUserRepository();
      const adminEmail = 'admin@gmail.com';
      const existingAdmins = await userRepo.findByCriteria('email = @email', { email: adminEmail });
      
      if (!existingAdmins || existingAdmins.length === 0) {
        const { hashPassword } = require('./utils');
        const hashedPw = await hashPassword('Aimabiet123.');
        
        await userRepo.executeQuery(
          "INSERT INTO Users (email, password_hash, full_name, is_active) VALUES (@email, @pw, 'Admin', 1)",
          { email: adminEmail, pw: hashedPw }
        );
        
        const newAdmins = await userRepo.findByCriteria('email = @email', { email: adminEmail });
        await userRepo.executeQuery(
          "INSERT INTO UserRoles (user_id, role_id) SELECT @userId, id FROM Roles WHERE name = 'ADMIN'",
          { userId: newAdmins[0].id }
        );
        logger.info('✅ Đã tạo tài khoản Admin mặc định: admin@gmail.com / Aimabiet123.');
      }
    } catch (err) {
      logger.error('⚠️ Không thể tự động tạo tài khoản Admin', err);
    }

    // Kết nối Redis
    logger.info('📌 Khởi tạo kết nối Redis...');
    await connectRedis();

    // Tạo ứng dụng Express
    logger.info('🔧 Tạo ứng dụng Express...');
    const app = createApp();

    // Tạo máy chủ HTTP với Socket.io
    logger.info('🔌 Thiết lập máy chủ WebSocket...');
    const server = createServer(app);

    // Khởi động dịch vụ lập lịch
    logger.info('⏱️  Khởi động dịch vụ lập lịch...');
    const scheduler = getSchedulerService();
    scheduler.start();

    // Bắt đầu lắng nghe
    const PORT = config.get('PORT');
    server.listen(PORT, () => {
      logger.info(`✅ Máy chủ chạy trên cổng ${PORT}`);
      logger.info(`🌐 URL: http://localhost:${PORT}`);
      logger.info(`🌍 Public URL (Ngrok): ${config.get('PUBLIC_URL')}`);
      logger.info(`📖 Kiểm tra sức khỏe: http://localhost:${PORT}/api/health`);
    });

    // Tắt máy chủ một cách nhẹ nhàng
    process.on('SIGTERM', () => {
      logger.info('SIGTERM nhận được, tắt máy chủ một cách nhẹ nhàng...');
      scheduler.stop();
      db.disconnect();
      server.close(() => {
        logger.info('Máy chủ đã dừng');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT nhận được, tắt máy chủ một cách nhẹ nhàng...');
      scheduler.stop();
      db.disconnect();
      server.close(() => {
        logger.info('Máy chủ đã dừng');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Không thể khởi động máy chủ', error);
    process.exit(1);
  }
}

// Khởi động máy chủ
if (require.main === module) {
  start();
}

module.exports = start;
