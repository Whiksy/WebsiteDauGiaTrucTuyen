/**
 * RepositoryFactory.js
 * Áp dụng Design Pattern: Factory & Registry
 * Quản lý khởi tạo và đảm bảo tính duy nhất (Singleton) cho các Repository.
 */

// LƯU Ý: Import DatabaseManager thông qua destructuring {} vì file đó export một Object
const { DatabaseManager } = require('./DatabaseManager');
const BaseRepository = require('./BaseRepository');
const UserRepository = require('./UserRepository');
const ProductRepository = require('./ProductRepository');
const AuctionRepository = require('./AuctionRepository');
const BidRepository = require('./BidRepository');
const PaymentRepository = require('./PaymentRepository');
const ActivityRepository = require('./ActivityRepository');
const CategoryRepository = require('./CategoryRepository');

// Vùng nhớ lưu trữ các Singleton instances
let instances = {
  databaseManager: null,
  userRepository: null,
  productRepository: null,
  auctionRepository: null,
  bidRepository: null,
  paymentRepository: null,
  activityRepository: null,
  categoryRepository: null,
};

class RepositoryFactory {
  static getDatabaseManager() {
    if (!instances.databaseManager) {
      instances.databaseManager = new DatabaseManager();
    }
    return instances.databaseManager;
  }

  static getUserRepository() {
    if (!instances.userRepository) {
      instances.userRepository = new UserRepository();
    }
    return instances.userRepository;
  }

  static getProductRepository() {
    if (!instances.productRepository) {
      instances.productRepository = new ProductRepository();
    }
    return instances.productRepository;
  }

  static getAuctionRepository() {
    if (!instances.auctionRepository) {
      instances.auctionRepository = new AuctionRepository();
    }
    return instances.auctionRepository;
  }

  static getBidRepository() {
    if (!instances.bidRepository) {
      instances.bidRepository = new BidRepository();
    }
    return instances.bidRepository;
  }

  static getPaymentRepository() {
    if (!instances.paymentRepository) {
      instances.paymentRepository = new PaymentRepository();
    }
    return instances.paymentRepository;
  }

  static getActivityRepository() {
    if (!instances.activityRepository) {
      instances.activityRepository = new ActivityRepository();
    }
    return instances.activityRepository;
  }

  static getCategoryRepository() {
    if (!instances.categoryRepository) {
      instances.categoryRepository = new CategoryRepository();
    }
    return instances.categoryRepository;
  }
}

module.exports = {
  RepositoryFactory,
  BaseRepository,
  UserRepository,
  ProductRepository,
  AuctionRepository,
  BidRepository,
  PaymentRepository,
  ActivityRepository,
  CategoryRepository
};