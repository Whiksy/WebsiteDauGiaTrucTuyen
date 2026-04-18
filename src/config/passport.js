const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getConfig } = require('./index');
const { ServiceFactory } = require('../services/ServiceFactory');

const config = getConfig();

passport.use(new GoogleStrategy({
    clientID: config.get('OAUTH.GOOGLE_CLIENT_ID'),
    clientSecret: config.get('OAUTH.GOOGLE_CLIENT_SECRET'),
    callbackURL: config.get('OAUTH.GOOGLE_CALLBACK_URL')
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const authService = ServiceFactory.getAuthService();
      // Chuyển thông tin cho AuthService xử lý và lấy ra { token, user }
      const result = await authService.googleLogin(profile);
      return done(null, result); 
    } catch (error) {
      return done(error, null);
    }
  }
));

module.exports = passport;