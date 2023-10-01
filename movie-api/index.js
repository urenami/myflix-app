/**
 * Required modules.
 */
const express = require("express");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const uuid = require("uuid"); // Adding the 'uuid' module
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");

const app = express();
const cors = require("cors");

const allowedOrigins = [
  "https://my-flixdb-56034.herokuapp.com",
  "https://localhost:1234",
  "https://ezmyflixapp.netlify.app",
];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        let message =
          "The CORS policy for this application doesn’t allow access from origin " +
          origin;
        return callback(new Error(message), false);
      }
      return callback(null, true);
    },
  })
);

let auth = require("./auth")(app);

const passport = require("passport");
require("./passport");

const Models = require("./models.js");

const Movies = Models.Movie;
const Users = Models.User;

mongoose.connect(process.env.CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "log.txt"),
  {
    flags: "a",
  }
);

app.use(morgan("common", { stream: accessLogStream }));

app.use(express.static("public"));

/**
 * Serve the documentation page.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.get("/documentation", (req, res) => {
  console.log("Documentation Request");
  res.sendFile("public/documentation.html", { root: __dirname });
});

/**
 * Welcome message on the root endpoint.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.get("/", (req, res) => {
  res.send("Welcome to myFlix app!");
});

/**
 * Retrieve all users.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/users",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const users = await Users.find();
      res.status(201).json(users);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Retrieve a user by username.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const user = await Users.findOne({ Username: req.params.Username });
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Retrieve movies.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movies = await Movies.find();
      res.json(movies);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Retrieve a movie by title.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/movies/:Title",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movie = await Movies.findOne({ Title: req.params.Title });
      res.json(movie);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Retrieve movies by genre.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/movies/genre/:genreName",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movies = await Movies.find({ "Genre.Name": req.params.genreName });
      res.json(movies);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Retrieve a director by name.
 * @function
 * @param {express.Request} req - The GET request object.
 * @param {express.Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the operation is complete.
 */
app.get(
  "/movies/director/:directorName",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movie = await Movies.findOne({ "Director.Name": req.params.directorName });
      res.json(movie.Director);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Create a new user.
 * @function
 * @param {express.Request} req - The POST request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.post(
  "/users",
  [
    check(
      "Username",
      "Username is required and must be at least five characters long"
    ).isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non-alphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  async (req, res) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let hashedPassword = Users.hashPassword(req.body.Password);

    try {
      const user = await Users.findOne({ Username: req.body.Username });
      if (user) {
        return res.status(400).send(req.body.Username + " already exists");
      } else {
        const newUser = await Users.create({
          Username: req.body.Username,
          Password: hashedPassword,
          Email: req.body.Email,
          Birthday: req.body.Birthday,
        });
        res.status(201).json(newUser);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
  }
);

/**
 * Add a movie to a user's list of favorite movies.
 * @function
 * @param {express.Request} req - The POST request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.post(
  "/users/:Username/movies/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
          $addToSet: { FavoriteMovies: req.params.id },
        },
        req.body
      );
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Update user information.
 * @function
 * @param {express.Request} req - The PUT request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.put(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  [
    check(
      "Username",
      "Username is required and must be at least five characters long"
    ).isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non-alphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  async (req, res) => {
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let hashedPassword = Users.hashPassword(req.body.Password);

    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
          $set: {
            Username: req.body.Username,
            Password: hashedPassword,
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          },
        }
      );
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  }
);

/**
 * Delete a user by username.
 * @function
 * @param {express.Request} req - The DELETE request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.delete("/users/:Username", async (req, res) => {
  try {
    const user = await Users.findOneAndRemove({ Username: req.params.Username });
    if (!user) {
      res.status(400).send(req.params.Username + " was not found");
    } else {
      res.status(200).send(req.params.Username + " was deleted.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error: " + err);
  }
});

/**
 * Remove a movie from a user's list of favorite movies.
 * @function
 * @param {express.Request} req - The DELETE request object.
 * @param {express.Response} res - The response object.
 * @returns {void}
 */
app.delete(
  "/users/:Username/movies/:id",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
          $pull: { FavoriteMovies: req.params.id },
        },
        req.body,
        { new: true }
      );
      res.status(200).json(updatedUser);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
);

/**
 * Morgan middleware error handling function
 * @function
 * @param {Error} err - The error object.
 * @param {express.Request} req - The request object.
 * @param {express.Response} res - The response object.
 * @param {express.NextFunction} next - The next function.
 * @returns {void}
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(404).send("error");
});

const port = process.env.PORT || 8080;

/**
 * Start the Express server.
 */
app.listen(port, () => {
  console.log("Listening on Port " + port);
});
