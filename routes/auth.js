const express = require("express");
const router = express.Router();
const authenticateUser = require("../middleware/authentication");
const { register, login, updateUser } = require("../controllers/auth");
const testUser = require("../middleware/testUser");

const rateLimiter = require("express-rate-limit");

// this limits the number of requests that can be made by a single user within a specified period of time
const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  // maximum number of requests
  max: 10,
  message: {
    msg: "Too manty requests from this IP, please try after 15 minutes",
  },
});

router.post("/register", apiLimiter, register);
router.post("/login", apiLimiter, login);
router.patch("/updateUser", authenticateUser, testUser, updateUser);

module.exports = router;
