const BaseRepository = require('./BaseRepository');
const { QueryBuilder } = require('../utils');

/**
 * Product Repository - Handles all product-related database operations
 */
class ProductRepository extends BaseRepository {
  constructor() {
    super('Products');
  }

  /**
   * Find product with details (seller info, images)
   */
  async findWithDetails(productId) {
    const query = `
      SELECT 
        p.id as Id, p.name as Name, p.description as Description, 
        p.price_starting as Price, p.stock as Stock, p.created_at as CreatedAt,
        p.category_id as CategoryId, c.name as CategoryName,
        u.full_name as SellerName,
        u.avatar as SellerAvatar
      FROM Products p
      LEFT JOIN Categories c ON p.category_id = c.id
      LEFT JOIN Users u ON p.seller_id = u.id
      WHERE p.id = @id
      GROUP BY p.id
    `;
    const request = this.db.createRequest();
    request.input('id', productId);
    
    const result = await request.query(query);
    return result.recordset[0] || null;
  }

  /**
   * Get product images
   */
  async getImages(productId) {
    const query = `SELECT * FROM ProductImages WHERE product_id = @productId ORDER BY id ASC`;
    const request = this.db.createRequest();
    request.input('productId', productId);
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Add product image
   */
  async addImage(productId, imageUrl, isPrimary = false) {
    const query = `INSERT INTO ProductImages (product_id, image, is_primary) VALUES (@productId, @imageUrl, @isPrimary)`;
    const request = this.db.createRequest();
    request.input('productId', productId);
    request.input('imageUrl', imageUrl);
    request.input('isPrimary', isPrimary);
    
    const result = await request.execute(query);
    return result.insertId;
  }

  /**
   * Delete image
   */
  async deleteImage(imageId) {
    const query = `DELETE FROM ProductImages WHERE id = @id`;
    const request = this.db.createRequest();
    request.input('id', imageId);
    
    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  /**
   * Find products by seller
   */
  async findBySeller(sellerId, limit = 20, offset = 0, searchTerm = '') {
    let query = `
      SELECT 
        p.id as Id, 
        p.name as Name, 
        p.description as Description, 
        p.price_starting as Price, 
        p.category_id as CategoryId,
        c.name as CategoryName,
        p.stock as Stock,
        (SELECT COUNT(*) FROM ProductImages WHERE product_id = p.id) as ImageCount, 
        CONCAT('/api/images/product/', p.id, '?index=0') as Thumbnail,
        EXISTS(SELECT 1 FROM Auctions WHERE product_id = p.id AND status IN ('ACTIVE', 'PROCESSING')) as IsInActiveAuction
      FROM Products p 
      LEFT JOIN Categories c ON p.category_id = c.id
      WHERE p.seller_id = @sellerId
    `;
    const params = { sellerId, limit: Number(limit), offset: Number(offset) };
    if (searchTerm) {
      query += ` AND p.name LIKE @searchTerm`;
      params.searchTerm = `%${searchTerm}%`;
    }
    query += ` ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset`;

    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Count products by seller
   */
  async countBySeller(sellerId, searchTerm = '') {
    let query = `SELECT COUNT(*) as total FROM Products WHERE seller_id = @sellerId`;
    const params = { sellerId };
    if (searchTerm) {
      query += ` AND name LIKE @searchTerm`;
      params.searchTerm = `%${searchTerm}%`;
    }
    const request = this.db.createRequest();
    Object.entries(params).forEach(([key, value]) => request.input(key, value));
    const result = await request.query(query);
    return result.recordset[0]?.total || 0;
  }

  /**
   * Find products by seller for auction creation (only active, in stock, not in active auction)
   */
  async findBySellerForAuctionCreation(sellerId) {
    const query = `
      SELECT
        p.id as Id,
        p.name as Name,
        p.description as Description,
        p.price_starting as Price,
        p.stock as Stock,
        p.category_id as CategoryId,
        c.name as CategoryName,
        EXISTS(SELECT 1 FROM Auctions a WHERE a.product_id = p.id AND a.status IN ('ACTIVE', 'PROCESSING')) as IsInActiveAuction,
        (SELECT COUNT(*) FROM ProductImages WHERE product_id = p.id) as ImageCount, 
        CONCAT('/api/images/product/', p.id, '?index=0') as Thumbnail
      FROM Products p
      LEFT JOIN Categories c ON p.category_id = c.id
      WHERE p.seller_id = @sellerId AND p.is_active = TRUE AND p.stock > 0
      ORDER BY p.created_at DESC
    `;
    const request = this.db.createRequest();
    request.input('sellerId', sellerId);
    
    const result = await request.query(query); // Assuming result.recordset contains the data
    this.logger.debug(`[findBySellerForAuctionCreation] Executed query for seller ${sellerId}, found ${result.recordset.length} records.`);
    return result.recordset; // Return the actual recordset
  }


  /**
   * Search products
   */
  async search(term, limit = 20, offset = 0) {
    const request = this.db.createRequest();
    const qb = new QueryBuilder('Products p')
      .select('p.*')
      .whereLike(['p.name', 'p.description'], term)
      .whereEquals('p.is_active', true, 'isActive')
      .orderBy('p.created_at', 'DESC')
      .paginate(limit, offset);
    
    const query = qb.build(request);
    const result = await request.query(query);
    return result.recordset;
  }
}

module.exports = ProductRepository;
