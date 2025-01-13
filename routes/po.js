const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get List API for booking_po
router.get("/", (req, res) => {
	const {booking_id} = req.query

	let query = `
    SELECT bp.po_number, 
           bp.booking_id,
					 MAX(bp.id) AS id,  -- Get the max id for each po_number
           MAX(bp.total_qty_items) AS total_qty_items,  -- Get the total_qty_items
           MAX(bp.total_received_items) AS total_received_items,  -- Get the total_received_items
           MAX(bp.notes) AS notes,  -- Get the notes
           MAX(bp.status) AS status,  -- Get the status
           MAX(bp.due_date) AS due_date,  -- Get the due_date
           u1.email AS created_by_email,
           JSON_ARRAYAGG(
               JSON_OBJECT(
                   'id', it.id,
                   'stock_code', it.stock_code,
                   'item_name', it.item_name,
									 'qty', it.qty
               )
           ) AS items
    FROM booking_po bp
    LEFT JOIN users u1 ON bp.created_by = u1.id
    LEFT JOIN booking_items bi ON bp.po_number = bi.po_number
    LEFT JOIN items it ON bi.item_id = it.id
  `

	// Add condition if booking_id is provided
	if (booking_id) {
		query += " WHERE bp.booking_id LIKE ?"
	}

	query += " GROUP BY bp.po_number, bp.booking_id, u1.email"

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
				items: item.items, // No need to parse JSON
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
	const {booking_id, item_ids, po_number} = req.body

	if (
		!booking_id ||
		!Array.isArray(item_ids) ||
		item_ids.length === 0 ||
		po_number === undefined
	) {
		return res
			.status(400)
			.json({message: "Booking ID, Item IDs, and PO Number are required"})
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

		// Query to update PO Number for each item
		const updatePoQuery = `
			UPDATE booking_items
			SET po_number = ?
			WHERE booking_id = ? AND item_id = ?
		`

		let completedUpdates = 0

		// Update each item
		item_ids.forEach((item_id) => {
			connection.query(
				updatePoQuery,
				[po_number, booking_id, item_id],
				(err) => {
					if (err) {
						return res.status(500).json({
							message: "Error updating PO Number",
							error: err,
						})
					}

					completedUpdates++

					// After all updates, update the existing data in booking_po table
					if (completedUpdates === item_ids.length) {
						const updateBookingPoQuery = `
							UPDATE booking_po
							SET total_qty_items = ?
							WHERE po_number = ?
						`

						// Update the total_qty_items for the given po_number
						connection.query(
							updateBookingPoQuery,
							[totalQty, po_number], // Update total_qty_items for the given po_number
							(err) => {
								if (err) {
									return res.status(500).json({
										message: "Error updating booking_po",
										error: err,
									})
								}

								res.status(200).json({
									message:
										"PO Number updated successfully for all items and total_qty_items updated in booking_po",
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
	const {status, notes, total_received_items, due_date} = req.body

	// Ensure at least one field is provided for update
	// if (!status && !notes && !total_received_items && !due_date) {
	// 	return res
	// 		.status(400)
	// 		.json({message: "Data must be provided for update"})
	// }

	// Build the query dynamically based on provided fields
	let query = "UPDATE booking_po SET"
	let queryParams = []

	let fieldsToUpdate = []

	if (total_received_items) {
		fieldsToUpdate.push("total_received_items = ?")
		queryParams.push(total_received_items)
	}

	if (status) {
		fieldsToUpdate.push("status = ?")
		queryParams.push(status)
	}

	if (due_date) {
		fieldsToUpdate.push("due_date = ?")
		queryParams.push(due_date)
	}

	if (notes) {
		fieldsToUpdate.push("notes = ?")
		queryParams.push(notes)
	}

	// If no fields to update, return an error
	if (fieldsToUpdate.length === 0) {
		return res
			.status(400)
			.json({message: "Data must be provided for update"})
	}

	// Join the fields to update with commas
	query += " " + fieldsToUpdate.join(", ") + " WHERE id = ?"
	queryParams.push(id)

	connection.query(query, queryParams, (err, result) => {
		if (err) {
			return res.status(500).send(err)
		}

		if (result.affectedRows === 0) {
			return res.status(404).json({message: "Booking PO not found"})
		}

		res.status(200).json({message: "Booking PO updated successfully"})
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
