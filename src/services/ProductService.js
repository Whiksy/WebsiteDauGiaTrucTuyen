const { getLogger } = require('../logger');
const { RepositoryFactory } = require('../repositories/RepositoryFactory');
const {
  validateNotEmpty,
  validatePositiveNumber,
  validateFutureDate
} = require('../utils');
const {
  ValidationError,
  NotFoundError,
  DatabaseError
} = require('../errors');
const { PRODUCT_STATUS, AUCTION_STATUS } = require('../constants/AppConstants');

/**
 * Product Service - Handles product management
 */
class ProductService {
  constructor() {
    this.productRepository = RepositoryFactory.getProductRepository();
    this.auctionRepository = RepositoryFactory.getAuctionRepository();
    this.logger = getLogger('ProductService');
  }

  /**
   * Create product
   */
  async createProduct(sellerId, productData) {
    try {
      validateNotEmpty(productData.name, 'Product name');
      validateNotEmpty(productData.description, 'Product description');

      // Ràng buộc số lượng ảnh tối đa là 5
      if (productData.images && Array.isArray(productData.images)) {
        if (productData.images.length > 5) {
          throw new ValidationError('A product can have a maximum of 5 images');
        }
      }

      const product = await this.productRepository.create({
        name: productData.name,
        description: productData.description,
        category_id: productData.categoryId || null,
        price_starting: productData.price || 0,
        stock: productData.stock || 1,
        seller_id: sellerId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      if (productData.images && Array.isArray(productData.images)) {
        if (productData.images.length > 5) {
          throw new ValidationError('A product can have a maximum of 5 images');
        }
        // TỐI ƯU: Lưu tất cả ảnh song song thay vì tuần tự
        const imagePromises = productData.images.map((img, i) => 
          this.productRepository.addImage(product, img, i === 0)
        );
        await Promise.all(imagePromises);
      }

      this.logger.info(`Product ${product} created by seller ${sellerId}`);
      return product;
    } catch (error) {
      this.logger.error('Failed to create product', error);
      throw error;
    }
  }

  /**
   * Get product details
   */
  async getProduct(productId) {
    try {
      const product = await this.productRepository.findWithDetails(productId);
      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      const images = await this.productRepository.getImages(productId);
      product.images = images.map((img, index) => `/api/images/product/${productId}?index=${index}`);

      return product;
    } catch (error) {
      this.logger.error(`Failed to get product ${productId}`, error);
      throw error;
    }
  }

  /**
   * Update product
   */
  async updateProduct(productId, sellerId, data) {
    try {
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      // Only seller can update their product
      if (product.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Cannot update product');
      }

      const updateData = {};
      if (data.name) updateData.name = validateNotEmpty(data.name);
      if (data.description) updateData.description = validateNotEmpty(data.description);
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId || null;
      if (data.status) updateData.is_active = (data.status === PRODUCT_STATUS.ACTIVE);

      updateData.updated_at = new Date();

      await this.productRepository.update(productId, updateData);

      // Handle images update
      if (data.keepImages !== undefined || (data.newImages && data.newImages.length > 0)) {
        // Delete all existing images for the product
        await this.productRepository.executeQuery('DELETE FROM ProductImages WHERE product_id = @productId', { productId });

        // Combine kept images and new images
        const allImages = [...(data.keepImages || []), ...(data.newImages || [])];

        if (allImages.length > 5) {
          throw new ValidationError('A product can have a maximum of 5 images');
        }

        // TỐI ƯU: Lưu ảnh song song khi cập nhật
        const imagePromises = allImages.map((img, i) => 
          this.productRepository.addImage(productId, img, i === 0)
        );
        await Promise.all(imagePromises);
      }

      this.logger.info(`Product ${productId} updated`);
      return this.getProduct(productId);
    } catch (error) {
      this.logger.error(`Failed to update product ${productId}`, error);
      throw error;
    }
  }

  /**
   * Add product image
   */
  async addImage(productId, sellerId, imageUrl) {
    try {
      const product = await this.productRepository.findById(productId);
      if (!product) {
        throw new NotFoundError('Product', productId);
      }

      if (product.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Cannot add image to product');
      }

      const imageId = await this.productRepository.addImage(productId, imageUrl);
      this.logger.info(`Image added to product ${productId}`);
      return imageId;
    } catch (error) {
      this.logger.error(`Failed to add image to product ${productId}`, error);
      throw error;
    }
  }

  /**
   * Delete image
   */
  async deleteImage(imageId, sellerId) {
    try {
      // In real scenario, verify seller owns the product
      await this.productRepository.deleteImage(imageId);
      this.logger.info(`Image ${imageId} deleted`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete image ${imageId}`, error);
      throw error;
    }
  }

  /**
   * Get seller products
   */
  async getSellerProducts(sellerId, limit = 20, offset = 0, searchTerm = '') {
    try {
      const products = await this.productRepository.findBySeller(sellerId, limit, offset, searchTerm);
      const total = await this.productRepository.countBySeller(sellerId, searchTerm);
      return { products, total };
    } catch (error) {
      this.logger.error(`Failed to get products for seller ${sellerId}`, error);
      throw error;
    }
  }

  /**
   * Get seller products for auction creation (with active auction status)
   */
  async getSellerProductsForAuctionCreation(sellerId) {
    try {
      const products = await this.productRepository.findBySellerForAuctionCreation(sellerId);
      this.logger.debug(`[getSellerProductsForAuctionCreation] Found ${products.length} products for seller ${sellerId}`);
      return products.map(p => ({
        ...p
      }));
    } catch (error) {
      this.logger.error(`Failed to get products for seller ${sellerId} for auction creation`, error);
      throw error;
    }
  }

  /**
   * Search products
   */
  async searchProducts(term, limit = 20, offset = 0) {
    try {
      return await this.productRepository.search(term, limit, offset);
    } catch (error) {
      this.logger.error('Failed to search products', error);
      throw error;
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(productId, sellerId) {
    try {
      const product = await this.productRepository.findById(productId);
      if (!product) throw new NotFoundError('Product', productId);
      if (product.seller_id !== sellerId) {
        throw new ValidationError('Không được phép: Cannot delete product');
      }
      await this.productRepository.delete(productId);
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductService;
