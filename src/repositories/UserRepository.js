const BaseRepository = require('./BaseRepository');

/**
 * User Repository - Handles all user-related database operations
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('Users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    const query = 'SELECT * FROM Users WHERE email = @email';
    const request = this.db.createRequest();
    request.input('email', email.toLowerCase().trim());
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Find user with roles
   */
  async findWithRoles(userId) {
    const query = `
      SELECT u.*, GROUP_CONCAT(r.name SEPARATOR ',') as roles
      FROM Users u
      LEFT JOIN UserRoles ur ON u.id = ur.user_id
      LEFT JOIN Roles r ON ur.role_id = r.id
      WHERE u.id = @id
      GROUP BY u.id
    `;
    const request = this.db.createRequest();
    request.input('id', userId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId) {
    const query = `
      SELECT r.id, r.name
      FROM Roles r
      JOIN UserRoles ur ON ur.role_id = r.id
      WHERE ur.user_id = @userId
    `;
    const request = this.db.createRequest();
    request.input('userId', userId);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Add role to user
   */
  async addRole(userId, roleId) {
    const query = `INSERT INTO UserRoles (user_id, role_id) VALUES (@userId, @roleId)`;
    const request = this.db.createRequest();
    request.input('userId', userId);
    request.input('roleId', roleId);
    
    await request.query(query);
    return true;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleId) {
    const query = `DELETE FROM UserRoles WHERE user_id = @userId AND role_id = @roleId`;
    const request = this.db.createRequest();
    request.input('userId', userId);
    request.input('roleId', roleId);
    
    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, data) {
    const allowedFields = ['full_name', 'avatar', 'phone', 'address', 'city', 'country'];
    const updateData = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (allowedFields.includes(key) && value !== undefined) {
        updateData[key] = value;
      }
    });
    
    if (Object.keys(updateData).length === 0) {
      return 0;
    }
    
    return this.update(userId, updateData);
  }

  /**
   * Search users
   */
  async search(term, limit = 20, offset = 0) {
    const query = `
      SELECT * FROM Users 
      WHERE full_name LIKE @term OR email LIKE @term
      ORDER BY full_name ASC
      LIMIT @offset, @limit
    `;
    const request = this.db.createRequest();
    request.input('term', `%${term}%`);
    request.input('offset', offset);
    request.input('limit', limit);
    
    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = UserRepository;
