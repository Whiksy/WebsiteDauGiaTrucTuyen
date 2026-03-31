const express = require('express');
const passport = require('passport');
const { ServiceFactory } = require('../services/ServiceFactory');
const { authenticate } = require('../middleware');
const { getConfig } = require('../config');

const router = express.Router();
const authService = ServiceFactory.getAuthService();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role, avatar } = req.body;

    const user = await authService.register(email, password, name, role, avatar);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.userId);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.updateProfile(req.userId, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    await authService.changePassword(req.userId, oldPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/google
 * @desc    Bắt đầu quá trình đăng nhập bằng Google
 * @access  Public
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

/**
 * @route   GET /api/auth/google/callback
 * @desc    Callback từ Google sau khi xác thực thành công
 * @access  Public
 */
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/?error=login_failed' }), (req, res) => {
  // req.user chứa token đã được trả về từ AuthService
  const config = getConfig();
  res.redirect(`${config.get('PUBLIC_URL')}/?token=${req.user.token}`);
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Gửi email yêu cầu đặt lại mật khẩu
 * @access  Public
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Đặt lại mật khẩu bằng token
 * @access  Public
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    res.status(200).json({
      success: true,
      message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.'
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
