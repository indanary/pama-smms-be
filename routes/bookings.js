const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get all bookings
router.get("/", (req, res) => {
	connection.query("SELECT * FROM bookings", (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}
		res.status(200).json(results)
	})
})

// Get a single booking by ID
router.get("/:id", (req, res) => {
	const bookingId = req.params.id
	connection.query(
		"SELECT * FROM bookings WHERE id = ?",
		[bookingId],
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

// Create a new booking
router.post("/", (req, res) => {
	const {po_number, due_date} = req.body

	if (!po_number || !due_date) {
		return res.status(400).json({message: "All fields are required"})
	}

	const approvedStatus = false
	const bookingStatus = "open"
	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.email

	const query =
		"INSERT INTO bookings (approved_status, po_number, due_date, booking_status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)"
	connection.query(
		query,
		[
			approvedStatus,
			po_number,
			due_date,
			bookingStatus,
			createdAt,
			createdBy,
		],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}

			res.status(201).json({message: "Bookings created successfully"})
		},
	)
})

// Update bookings
router.put("/:id", (req, res) => {
	const bookingId = req.params.id
	const {approved_status, po_number, due_date, booking_status} = req.body

	if (!approved_status || !po_number || !due_date || !booking_status) {
		return res.status(400).json({message: "All fields are required"})
	}

	const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const lastUpdatedBy = req.user.email

	const query =
		"UPDATE bookings SET approved_status = ?, po_number = ?, due_date = ?, booking_status = ?, last_updated_at = ?, last_updated_by = ? WHERE id = ?"
	connection.query(
		query,
		[
			approved_status,
			po_number,
			due_date,
			booking_status,
			lastUpdatedAt,
			lastUpdatedBy,
			bookingId,
		],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}
			if (results.affectedRows === 0) {
				res.status(404).json({message: "Booking not found"})
				return
			}
			res.status(200).json({message: "Booking updated successfully"})
		},
	)
})

// Delete booking
router.delete("/:id", (req, res) => {
	const bookingId = req.params.id
	const query = "DELETE FROM bookings WHERE id = ?"

	connection.query(query, [bookingId], (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}
		if (results.affectedRows === 0) {
			res.status(404).json({message: "Booking not found"})
			return
		}
		res.status(200).json({message: "Booking deleted successfully"})
	})
})

module.exports = router
