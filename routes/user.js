const express = require("express")
const router = express.Router()
const connection = require("../db")
const {v4: uuidv4} = require("uuid")
const bcrypt = require("bcryptjs")

// Get all users
router.get("/", (req, res) => {
	connection.query("SELECT * FROM users", (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}

		const resData = results.map((x) => ({
			id: x.id,
			name: x.name,
			email: x.email,
			role: x.role,
			created_at: x.created_at,
			created_by: x.created_by,
			last_updated_at: x.last_updated_at,
			last_updated_by: x.last_updated_by,
		}))

		res.status(200).json(resData)
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

			const resData = {
				id: results[0].id,
				name: results[0].name,
				email: results[0].email,
				role: results[0].role,
				created_at: results[0].created_at,
				created_by: results[0].created_by,
				last_updated_at: results[0].last_updated_at,
				last_updated_by: results[0].last_updated_by,
			}

			res.status(200).json(resData)
		},
	)
})

// Create a new user
router.post("/", (req, res) => {
	const {name, email, password, role} = req.body

	if (!name || !email || !password || !role) {
		return res.status(400).json({message: "All fields are required"})
	}

	const checkEmailQuery = "SELECT * FROM users WHERE email = ?"
	connection.query(checkEmailQuery, [email], async (err, results) => {
		if (results.length > 0) {
			return res.status(409).json({message: "User already exists"})
		}

		const userId = uuidv4()

		const hashPass = await bcrypt.hash(password, 10)

		const query =
			"INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)"
		connection.query(
			query,
			[userId, name, email, hashPass, role],
			(err, results) => {
				if (err) {
					res.status(500).send(err)
					return
				}
				res.status(201).json({
					message: "User created successfully",
				})
			},
		)
	})
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
