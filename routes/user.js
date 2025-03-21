const express = require("express")
const router = express.Router()
const connection = require("../db")
const {v4: uuidv4} = require("uuid")
const bcrypt = require("bcryptjs")
const {format} = require("date-fns")

// Get all users
router.get("/", (req, res) => {
	const {page = 1, limit = 10} = req.query // Default page to 1 and limit to 10
	const offset = (page - 1) * limit

	// Query to get total count of users
	const queryTotalCount =
		"SELECT COUNT(*) AS total FROM users WHERE is_removed = 0"

	// Query to get paginated users with created_by email
	const queryPaginatedUsers = `
		SELECT u.*, u2.email AS created_by_email
		FROM users u
		LEFT JOIN users u2 ON u.created_by = u2.id
		WHERE u.is_removed = 0
		LIMIT ? OFFSET ?
	`

	// Execute query to get total count of users
	connection.query(queryTotalCount, (err, countResults) => {
		if (err) {
			res.status(500).send(err)
			return
		}

		const totalItems = countResults[0].total
		const totalPages = Math.ceil(totalItems / limit)

		// Execute query to get paginated users
		connection.query(
			queryPaginatedUsers,
			[parseInt(limit), parseInt(offset)],
			(err, results) => {
				if (err) {
					res.status(500).send(err)
					return
				}

				const formattedResults = results.map((x) => ({
					id: x.id,
					name: x.name,
					email: x.email,
					role: x.role,
					created_at: x.created_at,
					created_by: x.created_by_email, // Use created_by_email
					last_updated_at: x.last_updated_at,
					last_updated_by: x.last_updated_by,
					is_active: x.is_active,

					created_by_email: undefined,
				}))

				// Respond with paginated data and pagination info
				res.status(200).json({
					page: parseInt(page),
					limit: parseInt(limit),
					totalItems,
					totalPages,
					data: formattedResults,
				})
			},
		)
	})
})

// Get user profile
router.get("/profile", (req, res) => {
	const userId = req.user.id

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
				is_active: results[0].is_active,
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

		const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const createdBy = req.user.id

		const query =
			"INSERT INTO users (id, name, email, password, role, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
		connection.query(
			query,
			[userId, name, email, hashPass, role, createdAt, createdBy],
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

// update status user
router.put("/:id/activate", (req, res) => {
	const {id} = req.params
	const {is_active} = req.body

	if (typeof is_active !== "boolean") {
		return res
			.status(400)
			.json({message: "is_active must be a boolean value"})
	}

	const query = "UPDATE users SET is_active = ? WHERE id = ?"

	connection.query(query, [is_active, id], (err, results) => {
		if (err) {
			res.status(500).send(err)
		}

		if (results.affectedRows === 0) {
			return res.status(404).json({message: "User not found"})
		}

		res.status(200).json({
			message: `User ${
				is_active ? "activated" : "deactivated"
			} successfully`,
		})
	})
})

module.exports = router
