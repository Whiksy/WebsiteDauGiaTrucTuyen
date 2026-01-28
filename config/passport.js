const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { sql } = require('./database');

// Uncomment and configure when you have OAuth credentials
/*
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const pool = await sql.connect();
    let user = await pool.request()
      .input('googleId', sql.VarChar, profile.id)
      .query('SELECT * FROM Users WHERE GoogleId = @googleId');

    if (user.recordset.length === 0) {
      // Create new user
      const result = await pool.request()
        .input('email', sql.VarChar, profile.emails[0].value)
        .input('name', sql.VarChar, profile.displayName)
        .input('googleId', sql.VarChar, profile.id)
        .query('INSERT INTO Users (Email, Name, GoogleId) OUTPUT INSERTED.Id VALUES (@email, @name, @googleId)');
      user = { recordset: [{ Id: result.recordset[0].Id, Email: profile.emails[0].value }] };
    }

    done(null, user.recordset[0]);
  } catch (error) {
    done(error, null);
  }
}));

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: '/api/auth/facebook/callback',
  profileFields: ['id', 'emails', 'name']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const pool = await sql.connect();
    let user = await pool.request()
      .input('facebookId', sql.VarChar, profile.id)
      .query('SELECT * FROM Users WHERE FacebookId = @facebookId');

    if (user.recordset.length === 0) {
      // Create new user
      const email = profile.emails ? profile.emails[0].value : `${profile.id}@facebook.com`;
      const name = `${profile.name.givenName} ${profile.name.familyName}`;
      const result = await pool.request()
        .input('email', sql.VarChar, email)
        .input('name', sql.VarChar, name)
        .input('facebookId', sql.VarChar, profile.id)
        .query('INSERT INTO Users (Email, Name, FacebookId) OUTPUT INSERTED.Id VALUES (@email, @name, @facebookId)');
      user = { recordset: [{ Id: result.recordset[0].Id, Email: email }] };
    }

    done(null, user.recordset[0]);
  } catch (error) {
    done(error, null);
  }
}));
*/

passport.serializeUser((user, done) => {
  done(null, user.Id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const pool = await sql.connect();
    const user = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Users WHERE Id = @id');
    done(null, user.recordset[0]);
  } catch (error) {
    console.error('passport.deserializeUser error:', error && (error.stack || error));
    done(error, null);
  }
});

module.exports = passport;