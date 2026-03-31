const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const { 
  validateEmail, 
  validatePassword, 
  validateName,
  hashPassword, 
  comparePassword, 
  generateToken 
} = require('../utils');
const {
  ValidationError,
  UnauthorizedError,
  ConflictError,
  NotFoundError
} = require('../errors');
const { getConfig } = require('../config');

/**
 * Authentication Service - Handles user authentication and authorization
 */
class AuthService {
  constructor() {
    this.userRepository = RepositoryFactory.getUserRepository();
    this.logger = getLogger('AuthService');
    this.config = getConfig();
    this._emailService = null;
  }

  // Áp dụng Tải trễ (Lazy load) để tránh lỗi phụ thuộc vòng tròn (Circular Dependency)
  get emailService() {
    if (!this._emailService) {
      const { ServiceFactory } = require('./ServiceFactory');
      this._emailService = ServiceFactory.getEmailService();
    }
    return this._emailService;
  }

  /**
   * Register new user
   */
  async register(email, password, name, role = 'User', avatar = null) {
    try {
      email = validateEmail(email);
      password = validatePassword(password);
      name = validateName(name);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new ConflictError('Email already registered', 'User');
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const userId = await this.userRepository.create({
        email: email,
        password_hash: hashedPassword,
        full_name: name,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      });

      this.logger.info(`User ${userId} registered successfully: ${email}`);
      
      // Luôn gán quyền mặc định là USER cho tài khoản mới
      const roleName = 'USER';
      await this.userRepository.executeQuery(
        'INSERT INTO UserRoles (user_id, role_id) SELECT @userId, id FROM Roles WHERE name = @roleName',
        { userId, roleName }
      );

      // Nếu người dùng chọn Seller, tự động tạo yêu cầu duyệt (Ghi vào bảng Activities)
      if (role === 'Seller') {
        await this.userRepository.executeQuery(
          "INSERT INTO Activities (user_id, action, description) VALUES (@userId, 'REQUEST_SELLER', 'Yêu cầu nâng cấp tài khoản Seller khi đăng ký')",
          { userId }
        );
      }

      return {
        id: userId,
        email,
        name,
        role
      };
    } catch (error) {
      this.logger.error('Registration failed', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      email = validateEmail(email);
      password = validatePassword(password);

      // Find user
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Generate token
      const token = generateToken(
        { id: user.id, email: user.email, name: user.full_name },
        this.config.get('JWT.SECRET'),
        this.config.get('JWT.EXPIRES_IN')
      );

      this.logger.info(`User ${user.id} logged in: ${email}`);

      // Lấy danh sách Roles và chuẩn hóa (VD: 'SELLER' -> 'Seller')
      const userWithRoles = await this.userRepository.findWithRoles(user.id);
      let roles = ['User'];
      if (userWithRoles && userWithRoles.roles) {
        roles = userWithRoles.roles.split(',').map(r => 
          r.trim().charAt(0).toUpperCase() + r.trim().slice(1).toLowerCase()
        );
      }

      return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar && Buffer.isBuffer(user.avatar) ? user.avatar.toString('utf8') : user.avatar,
        roles,
        token
      };
    } catch (error) {
      this.logger.error('Login failed', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId) {
    try {
      const user = await this.userRepository.findWithRoles(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      let roles = ['User'];
      if (user.roles) {
        roles = user.roles.split(',').map(r => 
          r.trim().charAt(0).toUpperCase() + r.trim().slice(1).toLowerCase()
        );
      }

      return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        avatar: user.avatar && Buffer.isBuffer(user.avatar) ? user.avatar.toString('utf8') : user.avatar,
        roles,
        createdAt: user.created_at
      };
    } catch (error) {
      this.logger.error(`Failed to get profile for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, data) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const updateData = {};

      if (data.name) {
        updateData.full_name = validateName(data.name);
      }
      if (data.avatar) {
        updateData.avatar = data.avatar;
      }
      if (data.phone) {
        updateData.phone = data.phone;
      }
      if (data.address) {
        updateData.address = data.address;
      }
      if (data.city) {
        updateData.city = data.city;
      }
      if (data.country) {
        updateData.country = data.country;
      }
      if (data.password) {
        validatePassword(data.password);
        updateData.password_hash = await hashPassword(data.password);
      }

      await this.userRepository.update(userId, updateData);

      this.logger.info(`User ${userId} profile updated`);

      return this.getProfile(userId);
    } catch (error) {
      this.logger.error(`Failed to update profile for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify old password
      const isValid = await comparePassword(oldPassword, user.password_hash);
      if (!isValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password
      newPassword = validatePassword(newPassword);

      // Should not be same as old password
      const isSame = await comparePassword(newPassword, user.password_hash);
      if (isSame) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash and update
      const hashedPassword = await hashPassword(newPassword);
      await this.userRepository.update(userId, { password_hash: hashedPassword });

      this.logger.info(`User ${userId} changed password`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to change password for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Handle Google OAuth Login
   */
  async googleLogin(profile) {
    try {
      const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
      if (!email) throw new ValidationError('Không thể lấy email từ Google');
      
      const name = profile.displayName;
      const avatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

      // Tìm xem user đã tồn tại chưa
      let user = await this.userRepository.findByEmail(email);

      // Nếu chưa có, tự động tạo tài khoản mới với role USER
      if (!user) {
        const userId = await this.userRepository.create({
          email: email,
          password_hash: '', // Để trống vì login bằng Google
          full_name: name,
          avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        });

        this.logger.info(`User ${userId} registered successfully via Google: ${email}`);
        
        // Luôn gán quyền mặc định là USER cho tài khoản Google mới
        const roleName = 'USER';
        await this.userRepository.executeQuery(
          'INSERT INTO UserRoles (user_id, role_id) SELECT @userId, id FROM Roles WHERE name = @roleName',
          { userId, roleName }
        );

        user = await this.userRepository.findById(userId);
      }

      // Generate token (Sử dụng lại logic từ hàm login)
      const { generateToken } = require('../utils');
      const token = generateToken(
        { id: user.id, email: user.email, name: user.full_name },
        this.config.get('JWT.SECRET'),
        this.config.get('JWT.EXPIRES_IN')
      );

      this.logger.info(`User ${user.id} logged in via Google: ${email}`);
      return { token, user };
    } catch (error) {
      this.logger.error('Google login failed', error);
      throw error;
    }
  }

  /**
   * Forgot password
   */
  async forgotPassword(email) {
    try {
      email = validateEmail(email);
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        // Để tránh lộ thông tin, luôn trả về thông báo thành công
        return { message: 'Nếu email tồn tại, bạn sẽ nhận được một liên kết đặt lại mật khẩu.' };
      }

      // Tạo token reset
      const resetToken = generateToken({ id: user.id }, this.config.get('JWT.SECRET'), '15m');
      const resetLink = `${this.config.get('PUBLIC_URL')}/?resetToken=${resetToken}`;

      // Gửi email (bất đồng bộ)
      this.emailService.sendPasswordResetEmail(user.email, user.full_name, resetLink)
        .catch(err => this.logger.error('Failed to send password reset email', err));

      return { message: 'Nếu email tồn tại, bạn sẽ nhận được một liên kết đặt lại mật khẩu.' };
    } catch (error) {
      this.logger.error('Forgot password failed', error);
      // Vẫn trả về thông báo chung để bảo mật
      return { message: 'Yêu cầu đã được xử lý.' };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      if (!token) throw new ValidationError('Token không hợp lệ hoặc đã hết hạn.');

      const decoded = this.verifyToken(token);
      if (!decoded || !decoded.id) {
        throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn.');
      }

      const userId = decoded.id;
      newPassword = validatePassword(newPassword);

      const hashedPassword = await hashPassword(newPassword);
      await this.userRepository.update(userId, { password_hash: hashedPassword });

      this.logger.info(`User ${userId} reset password successfully`);

      return true;
    } catch (error) {
      this.logger.error('Reset password failed', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      // Verify old password
      const isValid = await comparePassword(oldPassword, user.password_hash);
      if (!isValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Validate new password
      newPassword = validatePassword(newPassword);

      // Should not be same as old password
      const isSame = await comparePassword(newPassword, user.password_hash);
      if (isSame) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash and update
      const hashedPassword = await hashPassword(newPassword);
      await this.userRepository.update(userId, { password_hash: hashedPassword });

      this.logger.info(`User ${userId} changed password`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to change password for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Verify token
   */
  verifyToken(token) {
    try {
      const { verifyToken } = require('../utils');
      const decoded = verifyToken(token, this.config.get('JWT.SECRET'));
      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed', error);
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}

module.exports = AuthService;
