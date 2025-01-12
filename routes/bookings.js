const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get all bookings
router.get("/", (req, res) => {
	const {id} = req.query

	let query = `
		SELECT b.*, 
			   u1.email AS created_by_email, 
			   u2.email AS last_updated_by_email 
		FROM bookings b
		LEFT JOIN users u1 ON b.created_by = u1.id
		LEFT JOIN users u2 ON b.last_updated_by = u2.id
	`

	// Add search condition if stock_code is provided
	if (id) {
		query += " WHERE b.id LIKE ?"
	}

	connection.query(query, [id ? `%${id}%` : null], (err, results) => {
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
	
	const dueDate = ""
	const approvedStatus = false
	const bookingStatus = "open"
	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id
	const received = 0
	const receivedDate = ""
	const wrNo = ""

	const query =
		"INSERT INTO bookings (approved_status, due_date, booking_status, created_at, created_by, description, received, received_date, wr_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
	connection.query(
		query,
		[
			approvedStatus,
			dueDate,
			bookingStatus,
			createdAt,
			createdBy,
			description,
			received,
			receivedDate,
			wrNo,
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
	const {approved_status, due_date, received_date, wr_no} =
		req.body

	if (!bookingId) {
		return res.status(400).json({message: "Booking ID is required"})
	}

	// Initialize arrays for dynamic query construction
	const fieldsToUpdate = []
	const values = []

	// Add fields dynamically based on provided data
	if (approved_status !== undefined) {
		fieldsToUpdate.push("approved_status = ?")
		values.push(approved_status)
	}

	if (due_date !== undefined) {
		fieldsToUpdate.push("due_date = ?")
		values.push(due_date)
	}

	if (received_date !== undefined) {
		fieldsToUpdate.push("received_date = ?")
		fieldsToUpdate.push("received = ?")
		fieldsToUpdate.push("booking_status = ?")
		values.push(received_date, 1, "close")
	}

	if (wr_no !== undefined) {
		fieldsToUpdate.push("wr_no = ?")
		values.push(wr_no)
	}

	// Add the last updated fields
	const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const lastUpdatedBy = req.user.id
	fieldsToUpdate.push("last_updated_at = ?")
	fieldsToUpdate.push("last_updated_by = ?")
	values.push(lastUpdatedAt, lastUpdatedBy)

	// Complete the query with the booking ID
	const query = `UPDATE bookings SET ${fieldsToUpdate.join(
		", ",
	)} WHERE id = ?`

	values.push(bookingId)

	connection.query(query, values, (err, results) => {
		if (err) {
			res.status(500).send(err)
			return
		}
		if (results.affectedRows === 0) {
			res.status(404).json({message: "Booking not found"})
			return
		}
		res.status(200).json({message: "Booking updated successfully"})
	})
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
