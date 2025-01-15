const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

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
