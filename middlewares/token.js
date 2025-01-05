const jwt = require("jsonwebtoken")
const JWT_SECRET = "your_jwt_secret_key" // Secret key for JWT

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
	const token = req.headers["authorization"]?.split(" ")[1] // Extract token from Bearer

	if (!token) {
		return res
			.status(403)
			.json({message: "Access denied. No token provided."})
	}

	jwt.verify(token, JWT_SECRET, (err, decoded) => {
		if (err) {
			return res.status(401).json({message: "Invalid or expired token"})
		}

		req.user = decoded // Attach user info to request object
		next()
	})
}

module.exports = verifyToken
