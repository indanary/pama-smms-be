const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// get list
router.get("/", (req, res) => {
	const {search} = req.query

	let queryListBooking = `
		SELECT b.*,
			u1.email AS created_by_email,
			u2.email AS last_updated_by_email,
			GROUP_CONCAT(bi.po_number) AS po_numbers
		FROM bookings b
		LEFT JOIN users u1 ON b.created_by = u1.id
		LEFT JOIN users u2 ON b.last_updated_by = u2.id
		LEFT JOIN booking_items bi ON b.id = bi.booking_id
		WHERE b.is_removed = 0
	`

	// Add search condition
	if (search) {
		queryListBooking += `
			WHERE b.id = ? OR bi.po_number LIKE ?
		`
	}

	queryListBooking += ` GROUP BY b.id`

	connection.query(
		queryListBooking,
		[search, `%${search}%`],
		(err, results) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error fetching bookings", error: err})
			}

			const formattedResults = results.map((booking) => {
				return {
					id: booking.id,
					approved_status: booking.approved_status,
					booking_status: booking.booking_status,
					created_at: booking.created_at,
					created_by: booking.created_by_email,
					last_updated_at: booking.last_updated_at,
					last_updated_by: booking.last_updated_by_email ?? "",
					description: booking.description,
					received_date: booking.received_date,
					wr_no: booking.wr_no,
					received: booking.received,
					posting_wr: booking.posting_wr,
					cn_no: booking.cn_no,
					is_removed: booking.is_removed,
					remove_reason: booking.remove_reason,
					po_numbers: booking.po_numbers
						? booking.po_numbers.split(",")
						: [],

					created_by_email: undefined,
					last_updated_by_email: undefined,
				}
			})

			res.status(200).json(formattedResults)
		},
	)
})

// add booking
router.post("/", (req, res) => {
	const {description, cn_no, items} = req.body

	if (!description)
		return res.status(400).json({message: "Description are required"})

	if (!cn_no) return res.status(400).json({message: "CN No are required"})

	if (!items || items.length === 0)
		return res.status(400).json({message: "Items are required"})

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	const queryAddBooking =
		"INSERT INTO bookings (description, cn_no, created_at, created_by) VALUES (?, ?, ?, ?)"

	connection.query(
		queryAddBooking,
		[description, cn_no, createdAt, createdBy],
		(err, results) => {
			if (err) {
				res.status(500).send(err)
				return
			}

			const bookingId = results.insertId

			let completedInserts = 0

			items.forEach((item, index) => {
				if (item.qty < 1)
					return res
						.status(400)
						.json({message: "Item qty must be more than 0"})

				const queryAddBookingItems =
					"INSERT INTO booking_items (booking_id, item_id, item_qty) VALUES (?, ?, ?)"

				connection.query(
					queryAddBookingItems,
					[bookingId, item.id, item.qty],
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

module.exports = router
