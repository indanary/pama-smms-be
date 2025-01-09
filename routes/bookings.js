const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get all bookings
router.get("/", (req, res) => {
	const query = `
		SELECT b.*, 
			   u1.email AS created_by_email, 
			   u2.email AS last_updated_by_email 
		FROM bookings b
		LEFT JOIN users u1 ON b.created_by = u1.id
		LEFT JOIN users u2 ON b.last_updated_by = u2.id
	`

	connection.query(query, (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}

		const formattedResults = results.map((booking) => ({
			...booking,
			created_by: booking.created_by_email,
			last_updated_by: booking.last_updated_by_email,
		}))

		res.status(200).json(formattedResults)
	})
})

// Get a single booking by ID
router.get("/:id", (req, res) => {
	const bookingId = req.params.id

	const query = `
		SELECT b.*, 
			   u1.email AS created_by_email, 
			   u2.email AS last_updated_by_email 
		FROM bookings b
		LEFT JOIN users u1 ON b.created_by = u1.id
		LEFT JOIN users u2 ON b.last_updated_by = u2.id
		WHERE b.id = ?
	`

	connection.query(query, [bookingId], (err, results) => {
		if (err) {
			return res.status(500).send(err)
		}
		if (results.length === 0) {
			return res.status(404).json({message: "Booking not found"})
		}

		const booking = results[0]
		const formattedBooking = {
			...booking,
			created_by: booking.created_by_email,
			last_updated_by: booking.last_updated_by_email,
		}

		res.status(200).json(formattedBooking)
	})
})

// Create a new booking
router.post("/", (req, res) => {
	const {description, items} = req.body

	if (!description) {
		return res.status(400).json({message: "Description are required"})
	}

	const poNumber = ""
	const dueDate = ""
	const approvedStatus = false
	const bookingStatus = "open"
	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	const query =
		"INSERT INTO bookings (approved_status, po_number, due_date, booking_status, created_at, created_by, description) VALUES (?, ?, ?, ?, ?, ?, ?)"
	connection.query(
		query,
		[
			approvedStatus,
			poNumber,
			dueDate,
			bookingStatus,
			createdAt,
			createdBy,
			description,
		],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}

			const bookingId = results.insertId

			// Use a counter to track the number of inserts
			let completedInserts = 0

			items.forEach((item, index) => {
				const bookingItemQuery =
					"INSERT INTO booking_items (booking_id, item_id) VALUES (?, ?)"
				connection.query(
					bookingItemQuery,
					[bookingId, item],
					(error) => {
						if (error) {
							return res.status(500).send(error)
						}

						completedInserts++

						// Send response only after all items have been inserted
						if (completedInserts === items.length) {
							res.status(201).json({
								message: "Bookings created successfully",
							})
						}
					},
				)
			})
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

	// Delete related booking items first
	const deleteBookingItemsQuery =
		"DELETE FROM booking_items WHERE booking_id = ?"
	connection.query(deleteBookingItemsQuery, [bookingId], (err, results) => {
		if (err) {
			return res.status(500).send(err)
		}

		// Proceed to delete the booking after booking items are deleted
		const deleteBookingQuery = "DELETE FROM bookings WHERE id = ?"
		connection.query(deleteBookingQuery, [bookingId], (err, results) => {
			if (err) {
				return res.status(500).send(err)
			}
			if (results.affectedRows === 0) {
				return res.status(404).json({message: "Booking not found"})
			}
			res.status(200).json({
				message: "Booking deleted successfully",
			})
		})
	})
})

module.exports = router
