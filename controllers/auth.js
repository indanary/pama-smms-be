const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const connection = require("../db")

// Secret key for JWT
const JWT_SECRET = "your_jwt_secret_key"
const JWT_EXPIRATION = "1h" // Access token expiration
const JWT_REFRESH_EXPIRATION = "7d" // Refresh token expiration

// Generate JWT Access Token
const generateAccessToken = (user) => {
	return jwt.sign({id: user.id, role: user.role}, JWT_SECRET, {
		expiresIn: JWT_EXPIRATION,
	})
}

// Generate JWT Refresh Token
const generateRefreshToken = (user) => {
	return jwt.sign({id: user.id, role: user.role}, JWT_SECRET, {
		expiresIn: JWT_REFRESH_EXPIRATION,
	})
}

// Register a new user (optional, if you want signup functionality)
const registerUser = async (req, res) => {
	const {name, email, password, role} = req.body

	// Hash password
	const hashedPassword = await bcrypt.hash(password, 10)

	const query =
		"INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
	connection.query(
		query,
		[name, email, hashedPassword, role],
		(err, results) => {
			if (err) {
				return res.status(500).send(err)
			}
			res.status(201).json({
				id: results.insertId,
				message: "User created successfully",
			})
		},
	)
}

// Login (Authenticate User)
const loginUser = async (req, res) => {
	const {email, password} = req.body

	const query = "SELECT * FROM users WHERE email = ?"
	connection.query(query, [email], async (err, results) => {
		if (err) {
			return res.status(500).send(err)
		}
		if (results.length === 0) {
			return res.status(400).json({message: "Invalid credentials"})
		}

		const user = results[0]

		// Compare password
		const isMatch = await bcrypt.compare(password, user.password)
		if (!isMatch) {
			return res.status(400).json({message: "Invalid credentials"})
		}

		// Generate tokens
		const accessToken = generateAccessToken(user)
		const refreshToken = generateRefreshToken(user)

		// Optionally store refresh token in database (recommended for extra security)

		res.json({accessToken, refreshToken})
	})
}

// Refresh Token (Get a new access token using a refresh token)
const refreshAccessToken = (req, res) => {
	const {refreshToken} = req.body

	if (!refreshToken) {
		return res.status(400).json({message: "Refresh token is required"})
	}

	jwt.verify(refreshToken, JWT_SECRET, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.json({message: "Invalid or expired refresh token"})
		}

		// Generate a new access token
		const newAccessToken = generateAccessToken(decoded)
		res.json({accessToken: newAccessToken})
	})
}

// Logout (Revoke access by removing the refresh token)
const logoutUser = (req, res) => {
	// Optionally, remove the refresh token from the database if stored
	res.status(200).json({message: "Logged out successfully"})
}

module.exports = {registerUser, loginUser, refreshAccessToken, logoutUser}
