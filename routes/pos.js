const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// update booking po items
router.put("/items", async (req, res) => {
	try {
		const {booking_id, item_ids, po_number} = req.body

		if (
			!booking_id ||
			!Array.isArray(item_ids) ||
			item_ids.length === 0 ||
			!po_number
		) {
			return res
				.status(400)
				.json({
					message:
						"Booking ID, Item IDs, and PO Number are required",
				})
		}

		const connectionPromise = connection.promise()

		// Step 1: Update po_number for all matching item_ids
		const updateQuery = `
					UPDATE booking_items 
					SET po_number = ? 
					WHERE booking_id = ? AND item_id IN (?)
			`
		await connectionPromise.query(updateQuery, [
			po_number,
			booking_id,
			item_ids,
		])

		// Step 2: Get the sum of item_qty for the same booking_id and po_number
		const sumQuery = `
					SELECT SUM(item_qty) AS total_qty 
					FROM booking_items 
					WHERE booking_id = ? AND po_number = ?
			`
		const [sumResult] = await connectionPromise.query(sumQuery, [
			booking_id,
			po_number,
		])
		const total_qty_items = sumResult[0].total_qty || 0

		// Step 3: Update total_qty_items in booking_po
		const updatePoQuery = `
					UPDATE booking_po 
					SET total_qty_items = ? 
					WHERE booking_id = ? AND po_number = ?
			`
		await connectionPromise.query(updatePoQuery, [
			total_qty_items,
			booking_id,
			po_number,
		])

		res.status(200).json({
			message:
				"Booking PO updated successfully",
			total_qty_items,
		})
	} catch (error) {
		res.status(500).json({message: "Error updating data", error})
	}
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

// delete po
router.delete("/:id", (req, res) => {
	const {id} = req.params

	if (!id) {
		return res.status(400).json({message: "Missing required id parameter"})
	}

	const deleteQuery = `DELETE FROM booking_po WHERE id = ?`

	connection.query(deleteQuery, [id], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error deleting booking_po", error: err})
		}

		if (result.affectedRows === 0) {
			return res
				.status(404)
				.json({message: "No record found with the given ID"})
		}

		res.status(200).json({message: "Booking PO deleted successfully"})
	})
})

module.exports = router
