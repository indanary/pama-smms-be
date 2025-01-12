const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get List API for booking_po
router.get("/", (req, res) => {
	const {booking_id} = req.query

	let query = `
    SELECT i.*, 
           u1.email AS created_by_email
    FROM booking_po i
    LEFT JOIN users u1 ON i.created_by = u1.id
  `

	// Add condition if booking_id is provided
	if (booking_id) {
		query += " WHERE i.booking_id LIKE ?"
	}

	connection.query(
		query,
		[booking_id ? `%${booking_id}%` : null],
		(err, results) => {
			if (err) {
				return res.status(500).json({
					message: "Error fetching booking PO list",
					error: err,
				})
			}

			const formattedResults = results.map((item) => ({
				...item,
				created_by: item.created_by_email,
			}))

			res.status(200).json(formattedResults)
		},
	)
})

// Get Detail API for booking_po
router.get("/:id", (req, res) => {
	const {id} = req.params
	const query = "SELECT * FROM booking_po WHERE id = ?"

	connection.query(query, [id], (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching booking PO detail", error: err})
		}

		if (results.length === 0) {
			return res.status(404).json({message: "PO Number not found"})
		}

		res.status(200).json(results[0])
	})
})

router.post("/", (req, res) => {
	const {po_numbers, booking_id} = req.body

	if (!po_numbers || !Array.isArray(po_numbers)) {
		return res.status(400).json({message: "PO Numbers must be an array"})
	}

	if (!booking_id) {
		return res.status(400).json({message: "Booking ID is required"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id
	const status = "" // Set default value or adjust as necessary
	const notes = "" // Set default value or adjust as necessary

	const query =
		"INSERT INTO booking_po (booking_id, po_number, created_at, created_by, status, notes) VALUES ?"
	const values = po_numbers.map((po_number) => [
		booking_id,
		po_number,
		createdAt,
		createdBy,
		status,
		notes,
	])

	connection.query(query, [values], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error inserting PO Numbers", error: err})
		}
		res.status(201).json({
			message: "PO Numbers inserted successfully",
			insertedCount: result.affectedRows,
		})
	})
})

router.put("/po_items", (req, res) => {
	const {booking_id, item_ids, po_id} = req.body

	if (
		!booking_id ||
		!Array.isArray(item_ids) ||
		item_ids.length === 0 ||
		po_id === undefined
	) {
		return res
			.status(400)
			.json({message: "Booking ID, Item ID, and PO ID are required"})
	}

	// Query to get the total qty from all items that match the item_ids
	const getQtyQuery = `
		SELECT SUM(i.qty) AS total_qty
		FROM booking_items bi
		JOIN items i ON bi.item_id = i.id
		WHERE bi.booking_id = ? AND bi.item_id IN (?)
	`

	// Use an array for the IN clause
	connection.query(getQtyQuery, [booking_id, item_ids], (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching item quantities", error: err})
		}

		// Ensure total_qty exists and is greater than 0
		if (!results[0].total_qty) {
			return res
				.status(404)
				.json({message: "No items found for the given item IDs"})
		}

		const totalQty = results[0].total_qty

		// Query to update PO ID for each item
		const updatePoQuery = `
			UPDATE booking_items
			SET po_id = ?
			WHERE booking_id = ? AND item_id = ?
		`

		let completedUpdates = 0

		// Update each item
		item_ids.forEach((item_id) => {
			connection.query(
				updatePoQuery,
				[po_id, booking_id, item_id],
				(err) => {
					if (err) {
						return res
							.status(500)
							.json({message: "Error updating PO ID", error: err})
					}

					completedUpdates++

					// After all updates, update the existing data in booking_po table
					if (completedUpdates === item_ids.length) {
						const updateBookingPoQuery = `
							UPDATE booking_po
							SET total_qty_items = ?
							WHERE booking_id = ?
						`

						// Update the total_qty_items for the booking_id
						connection.query(
							updateBookingPoQuery,
							[totalQty, booking_id], // Update total_qty_items for the given booking_id
							(err) => {
								if (err) {
									return res.status(500).json({
										message: "Error updating booking_po",
										error: err,
									})
								}

								res.status(200).json({
									message:
										"PO ID updated successfully for all items and total_qty_items updated in booking_po",
								})
							},
						)
					}
				},
			)
		})
	})
})

// Update API for booking_po
router.put("/:id", (req, res) => {
	const {id} = req.params
	const {status, notes} = req.body

	// Ensure at least one field is provided for update
	if (!status) {
		return res
			.status(400)
			.json({message: "Status or notes must be provided for update"})
	}

	// Build the query dynamically based on provided fields
	let query = "UPDATE booking_po SET"
	let queryParams = []

	if (status) {
		query += " status = ?"
		queryParams.push(status)
	}

	if (notes) {
		if (queryParams.length > 0) {
			query += ","
		}
		query += " notes = ?"
		queryParams.push(notes)
	}

	query += " WHERE id = ?"
	queryParams.push(id)

	connection.query(query, queryParams, (err, result) => {
		if (err) {
			return res.status(500).send(err)
		}

		if (result.affectedRows === 0) {
			return res.status(404).json({message: "PO Number not found"})
		}

		res.status(200).json({message: "PO Number updated successfully"})
	})
})

// Delete API for booking_po
router.delete("/:id", (req, res) => {
	const {id} = req.params

	const query = "DELETE FROM booking_po WHERE id = ?"
	connection.query(query, [id], (err, result) => {
		if (err) {
			return res.status(500).send(err)
		}

		if (result.affectedRows === 0) {
			return res.status(404).json({message: "PO Number not found"})
		}

		res.status(200).json({message: "PO Number deleted successfully"})
	})
})

module.exports = router
