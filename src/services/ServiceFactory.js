/**
 * ServiceFactory.js
 * Áp dụng Design Pattern: Factory & Registry
 * Quản lý khởi tạo và đảm bảo tính duy nhất (Singleton) cho các Services.
 */

const AuthService = require('./AuthService');
const ProductService = require('./ProductService');
const AuctionService = require('./AuctionService');
const BiddingService = require('./BiddingService');
const PaymentService = require('./PaymentService');
const AdminService = require('./AdminService');
const CategoryService = require('./CategoryService');
const WalletService = require('./WalletService');
const EmailService = require('./EmailService');

// Vùng nhớ lưu trữ các Singleton instances
let instances = {
  authService: null,
  productService: null,
  auctionService: null,
  biddingService: null,
  paymentService: null,
  adminService: null,
  categoryService: null,
  walletService: null,
  emailService: null,
};

class ServiceFactory {
  static getAuthService() {
    if (!instances.authService) {
      instances.authService = new AuthService();
    }
    return instances.authService;
  }

  static getProductService() {
    if (!instances.productService) {
      instances.productService = new ProductService();
    }
    return instances.productService;
  }

  static getAuctionService() {
    if (!instances.auctionService) {
      instances.auctionService = new AuctionService();
    }
    return instances.auctionService;
  }

  static getBiddingService() {
    if (!instances.biddingService) {
      instances.biddingService = new BiddingService();
    }
    return instances.biddingService;
  }

  static getPaymentService() {
    if (!instances.paymentService) {
      instances.paymentService = new PaymentService();
    }
    return instances.paymentService;
  }

  static getAdminService() {
    if (!instances.adminService) {
      instances.adminService = new AdminService();
    }
    return instances.adminService;
  }

  static getCategoryService() {
    if (!instances.categoryService) {
      instances.categoryService = new CategoryService();
    }
    return instances.categoryService;
  }

  static getWalletService() {
    if (!instances.walletService) {
      instances.walletService = new WalletService();
    }
    return instances.walletService;
  }

  static getEmailService() {
    if (!instances.emailService) {
      instances.emailService = new EmailService();
    }
    return instances.emailService;
  }
}

module.exports = {
  ServiceFactory,
  AuthService,
  ProductService,
  AuctionService,
  BiddingService,
  PaymentService,
  AdminService,
  CategoryService,
  WalletService,
  EmailService
};