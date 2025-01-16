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

// get list booking po
router.get("/:id/po", (req, res) => {
	const {id} = req.params

	const queryGetListBookingPo = `
		SELECT 
			bp.id AS po_id, 
			bp.booking_id, 
			bp.po_number, 
			bp.created_at, 
			bp.created_by, 
			bp.status, 
			bp.due_date, 
			bp.total_qty_items, 
			bp.total_received_items, 
			u1.email AS created_by_email,
			i.id AS item_id,
			i.stock_code,
			i.part_no,
			i.item_name,
			bi.item_qty
		FROM booking_po bp
		LEFT JOIN users u1 ON bp.created_by = u1.id
		LEFT JOIN booking_items bi ON bi.po_number = bp.po_number
		LEFT JOIN items i ON bi.item_id = i.id
		WHERE bp.booking_id = ? 
		AND bp.is_removed = 0
	`

	connection.query(queryGetListBookingPo, [id], (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching booking po", error: err})
		}

		// Group items by po_number
		const poMap = {}

		results.forEach((row) => {
			const {
				po_id,
				booking_id,
				po_number,
				created_at,
				created_by,
				status,
				due_date,
				total_qty_items,
				total_received_items,
				item_id,
				stock_code,
				part_no,
				item_name,
				item_qty,
			} = row

			if (!poMap[po_number]) {
				poMap[po_number] = {
					id: po_id,
					booking_id,
					po_number,
					created_at,
					created_by,
					status,
					due_date,
					total_qty_items,
					total_received_items,
					items: [],
				}
			}

			if (item_id) {
				poMap[po_number].items.push({
					id: item_id,
					stock_code,
					part_no,
					item_name,
					item_qty,
				})
			}
		})

		// Convert poMap to an array
		const formattedResults = Object.values(poMap)

		res.status(200).json(formattedResults)
	})
})

// get detail
router.get("/:id", (req, res) => {
	const bookingId = req.params.id

	let queryListBooking = `
		SELECT b.*,
			u1.email AS created_by_email,
			u2.email AS last_updated_by_email,
			GROUP_CONCAT(bi.po_number) AS po_numbers
		FROM bookings b
		LEFT JOIN users u1 ON b.created_by = u1.id
		LEFT JOIN users u2 ON b.last_updated_by = u2.id
		LEFT JOIN booking_items bi ON b.id = bi.booking_id
		WHERE b.id = ?
		GROUP BY b.id
	`

	connection.query(queryListBooking, [bookingId], (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching bookings", error: err})
		}

		const formattedResults = {
			id: results[0].id,
			approved_status: results[0].approved_status,
			booking_status: results[0].booking_status,
			created_at: results[0].created_at,
			created_by: results[0].created_by_email,
			last_updated_at: results[0].last_updated_at,
			last_updated_by: results[0].last_updated_by_email ?? "",
			description: results[0].description,
			received_date: results[0].received_date,
			wr_no: results[0].wr_no,
			received: results[0].received,
			posting_wr: results[0].posting_wr,
			cn_no: results[0].cn_no,
			is_removed: results[0].is_removed,
			remove_reason: results[0].remove_reason,
			po_numbers: results[0].po_numbers
				? results[0].po_numbers.split(",")
				: [],

			created_by_email: undefined,
			last_updated_by_email: undefined,
		}

		res.status(200).json(formattedResults)
	})
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

// update booking po
router.put("/:id/po", (req, res) => {
	const {id} = req.params
	const {po_numbers} = req.body

	if (!po_numbers || !Array.isArray(po_numbers)) {
		return res.status(400).json({message: "PO Numbers must be an array"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	// Generate query placeholders for each PO number
	const placeholders = po_numbers.map(() => "(?, ?, ?, ?)").join(", ")
	const queryAddBookingPo = `
		INSERT INTO booking_po (booking_id, po_number, created_at, created_by) 
		VALUES ${placeholders}
	`

	// Flatten the values array to match the placeholders
	const values = po_numbers.flatMap((po_number) => [
		Number(id),
		po_number,
		createdAt,
		createdBy,
	])

	connection.query(queryAddBookingPo, values, (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error inserting PO Numbers", error: err})
		}

		res.status(201).json({
			message: "PO Numbers inserted successfully",
			insertedCount: results.affectedRows,
		})
	})
})

// update bookings
router.put("/:id", (req, res) => {
	const bookingId = req.params.id
	const {approved_status, received_date, wr_no, posting_wr} = req.body

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

	if (received_date !== undefined) {
		fieldsToUpdate.push("received_date = ?")
		fieldsToUpdate.push("received = ?")
		values.push(received_date, 1)
	}

	if (wr_no !== undefined) {
		fieldsToUpdate.push("wr_no = ?")
		values.push(wr_no)
	}

	if (posting_wr !== undefined) {
		fieldsToUpdate.push("posting_wr = ?")
		fieldsToUpdate.push("booking_status = ?")
		values.push(posting_wr, "closed")
	}

	const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const lastUpdatedBy = req.user.id
	fieldsToUpdate.push("last_updated_at = ?")
	fieldsToUpdate.push("last_updated_by = ?")
	values.push(lastUpdatedAt, lastUpdatedBy)

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

module.exports = router
