const jwtSecret = "your_jwt_secret"; // Secret key used for JWT encryption

const jwt = require("jsonwebtoken"),
  passport = require("passport");

require("./passport"); // Import local passport configuration

/**
 * Generates a JWT token for a user.
 *
 * @param {object} user - The user object to generate a token for.
 * @returns {string} - The JWT token.
 */
let generateJWTToken = (user) => {
  return jwt.sign(user, jwtSecret, {
    subject: user.Username, // JWT encoded username
    expiresIn: "7d", // Token expires in 7 days
    algorithm: "HS256", // 256-bit encryption algorithm
  });
};

/**
 * Handles the POST request for user login.
 *
 * @param {object} router - The Express router object.
 */
module.exports = (router) => {
  router.post("/login", (req, res) => {
    passport.authenticate("local", { session: false }, (error, user, info) => {
      if (error || !user) {
        return res.status(400).json({
          message: "Authentication failed: " + error,
        });
      }
      req.login(user, { session: false }, (error) => {
        if (error) {
          return res.status(400).json({
            message: "Authentication failed: " + error,
          });
        }
        let token = generateJWTToken(user.toJSON());
        return res.json({ user, token });
      });
    })(req, res);
  });
};
