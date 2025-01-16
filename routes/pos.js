const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// update booking po items
router.put("/items", (req, res) => {
	const {po_number, item_ids} = req.body

	if (!po_number) {
		return res.status(400).json({message: "PO Number is required"})
	}

	if (!item_ids || !Array.isArray(item_ids)) {
		return res.status(400).json({message: "Item IDs must be an array"})
	}

	const queryUpdatePoNumber = `
		UPDATE booking_items
		SET po_number = ?
		WHERE item_id = ?
	`

	const queryGetTotalItemQty = `
		SELECT SUM(item_qty) AS total_qty
		FROM booking_items
		WHERE po_number = ?
	`

	const queryUpdateBookingPo = `
		UPDATE booking_po
		SET total_qty_items = ?
		WHERE po_number = ?
	`

	// Use a transaction to ensure all updates are performed atomically
	connection.beginTransaction((err) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Transaction error", error: err})
		}

		const updates = item_ids.map((item_id) => {
			return new Promise((resolve, reject) => {
				connection.query(
					queryUpdatePoNumber,
					[po_number, item_id],
					(err, result) => {
						if (err) {
							return reject(err)
						}
						resolve(result)
					},
				)
			})
		})

		Promise.all(updates)
			.then(() => {
				// Get the total item_qty for the po_number
				connection.query(
					queryGetTotalItemQty,
					[po_number],
					(err, results) => {
						if (err) {
							return connection.rollback(() => {
								res.status(500).json({
									message:
										"Error fetching total item quantity",
									error: err,
								})
							})
						}

						const totalQty = results[0].total_qty

						// Update the booking_po with the total quantity
						connection.query(
							queryUpdateBookingPo,
							[totalQty, po_number],
							(err, result) => {
								if (err) {
									return connection.rollback(() => {
										res.status(500).json({
											message:
												"Error updating booking po",
											error: err,
										})
									})
								}

								connection.commit((err) => {
									if (err) {
										return connection.rollback(() => {
											res.status(500).json({
												message: "Commit error",
												error: err,
											})
										})
									}
									res.status(200).json({
										message:
											"PO Items updated successfully",
										totalQty,
									})
								})
							},
						)
					},
				)
			})
			.catch((err) => {
				connection.rollback(() => {
					res.status(500).json({
						message: "Error updating PO Items",
						error: err,
					})
				})
			})
	})
})

// update po
router.put("/:id", (req, res) => {
	const poId = req.params.id
	const {total_received_items, status, due_date} = req.body

	if (!poId) return res.status(400).json({message: "PO ID is required"})

	const fieldsToUpdate = []
	const values = []

	if (total_received_items !== undefined) {
		fieldsToUpdate.push("total_received_items = ?")
		values.push(total_received_items)
	}

	if (status !== undefined) {
		fieldsToUpdate.push("status = ?")
		values.push(status)
	}

	if (due_date !== undefined) {
		fieldsToUpdate.push("due_date = ?")
		values.push(due_date)
	}

	const queryUpdatePo = `UPDATE booking_po SET ${fieldsToUpdate.join(
		", ",
	)} WHERE id = ?`

	values.push(poId)

	connection.query(queryUpdatePo, values, (err, results) => {
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
