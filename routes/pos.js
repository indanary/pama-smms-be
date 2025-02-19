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
			return res.status(400).json({
				message: "Booking ID, Item IDs, and PO Number are required",
			})
		}

		const connectionPromise = connection.promise()
		const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const lastUpdatedBy = req.user.id

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

		const updateBookingQuery = `
			UPDATE bookings 
			SET last_updated_at = ?, last_updated_by = ? 
			WHERE id = ?
		`
		await connectionPromise.query(updateBookingQuery, [
			lastUpdatedAt,
			lastUpdatedBy,
			booking_id,
		])

		res.status(200).json({
			message: "Booking PO updated successfully",
			total_qty_items,
		})
	} catch (error) {
		res.status(500).json({message: "Error updating data", error})
	}
})

// update po
router.put("/:id", async (req, res) => {
	try {
		const poId = req.params.id
		const { total_received_items, status, due_date } = req.body

		if (!poId) {
			return res.status(400).json({ message: "PO ID is required" })
		}

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

		if (fieldsToUpdate.length === 0) {
			return res.status(400).json({ message: "No valid fields to update" })
		}

		const connectionPromise = connection.promise()
		const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const lastUpdatedBy = req.user.id

		// Step 1: Update booking_po
		const queryUpdatePo = `UPDATE booking_po SET ${fieldsToUpdate.join(", ")} WHERE id = ?`
		values.push(poId)

		const [updateResults] = await connectionPromise.query(queryUpdatePo, values)

		if (updateResults.affectedRows === 0) {
			return res.status(404).json({ message: "Booking PO not found" })
		}

		// Step 2: Get the booking_id associated with the updated booking_po
		const queryGetBookingId = `SELECT booking_id FROM booking_po WHERE id = ?`
		const [bookingResult] = await connectionPromise.query(queryGetBookingId, [poId])

		if (bookingResult.length === 0) {
			return res.status(404).json({ message: "Booking ID not found for this PO" })
		}

		const bookingId = bookingResult[0].booking_id

		// Step 3: Update last_updated_at and last_updated_by in bookings
		const queryUpdateBooking = `
			UPDATE bookings 
			SET last_updated_at = ?, last_updated_by = ? 
			WHERE id = ?
		`
		await connectionPromise.query(queryUpdateBooking, [lastUpdatedAt, lastUpdatedBy, bookingId])

		res.status(200).json({ message: "Booking PO updated successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error updating booking PO", error })
	}
})

// delete po
router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params

		if (!id) {
			return res.status(400).json({ message: "Missing required id parameter" })
		}

		const connectionPromise = connection.promise()
		const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const lastUpdatedBy = req.user.id

		// Step 1: Get the booking_id before deletion
		const queryGetBookingId = `SELECT booking_id FROM booking_po WHERE id = ?`
		const [bookingResult] = await connectionPromise.query(queryGetBookingId, [id])

		if (bookingResult.length === 0) {
			return res.status(404).json({ message: "No record found with the given ID" })
		}

		const bookingId = bookingResult[0].booking_id

		// Step 2: Delete the booking_po record
		const deleteQuery = `DELETE FROM booking_po WHERE id = ?`
		const [deleteResult] = await connectionPromise.query(deleteQuery, [id])

		if (deleteResult.affectedRows === 0) {
			return res.status(404).json({ message: "No record found with the given ID" })
		}

		// Step 3: Update last_updated_at and last_updated_by in bookings
		const queryUpdateBooking = `
			UPDATE bookings 
			SET last_updated_at = ?, last_updated_by = ? 
			WHERE id = ?
		`
		await connectionPromise.query(queryUpdateBooking, [lastUpdatedAt, lastUpdatedBy, bookingId])

		res.status(200).json({ message: "Booking PO deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting booking_po", error })
	}
})


module.exports = router
