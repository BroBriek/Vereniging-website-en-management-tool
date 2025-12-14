const LocalStrategy = require('passport-local').Strategy;
const { User } = require('../models');

module.exports = function(passport) {
  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) {
        return done(null, false, { message: 'Gebruikersnaam niet gevonden.' });
      }
      if (user.isActive === false) {
        return done(null, false, { message: 'Account is inactief.' });
      }
      const isMatch = await user.validatePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Wachtwoord onjuist.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};