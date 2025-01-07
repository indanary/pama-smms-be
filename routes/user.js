const express = require("express")
const router = express.Router()
const connection = require("../db")
const {v4: uuidv4} = require("uuid")

// Get all users
router.get("/", (req, res) => {
	connection.query("SELECT * FROM users", (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}
		res.status(200).json(results)
	})
})

// Get a single user by ID
router.get("/:id", (req, res) => {
	const userId = req.params.id
	connection.query(
		"SELECT * FROM users WHERE id = ?",
		[userId],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}
			if (results.length === 0) {
				res.status(404).json({message: "User not found"})
				return
			}
			res.status(200).json(results[0])
		},
	)
})

// Create a new user
router.post("/", (req, res) => {
	const {name, email, password, role} = req.body

	if (!name || !email || !password || !role) {
		return res.status(400).json({message: "All fields are required"})
	}

	const userId = uuidv4()

	const query =
		"INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)"
	connection.query(
		query,
		[userId, name, email, password, role],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}
			res.status(201).json({
				id: userId,
				message: "User created successfully",
			})
		},
	)
})

// Update an existing user
router.put("/:id", (req, res) => {
	const userId = req.params.id
	const {name, email, password, role} = req.body

	if (!name || !email || !password || !role) {
		return res.status(400).json({message: "All fields are required"})
	}

	const query =
		"UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?"
	connection.query(
		query,
		[name, email, password, role, userId],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}
			if (results.affectedRows === 0) {
				res.status(404).json({message: "User not found"})
				return
			}
			res.status(200).json({message: "User updated successfully"})
		},
	)
})

// Delete a user
router.delete("/:id", (req, res) => {
	const userId = req.params.id
	const query = "DELETE FROM users WHERE id = ?"

	connection.query(query, [userId], (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}
		if (results.affectedRows === 0) {
			res.status(404).json({message: "User not found"})
			return
		}
		res.status(200).json({message: "User deleted successfully"})
	})
})

module.exports = router
