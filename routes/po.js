const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Get List API for booking_po
router.get("/", (req, res) => {
	const query = `
    SELECT i.*, 
			   u1.email AS created_by_email, 
		FROM booking_po i
		LEFT JOIN users u1 ON i.created_by = u1.id
  `

	connection.query(query, (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching booking PO list", error: err})
		}

		const formattedResults = results.map((item) => ({
			...item,
			created_by: item.created_by_email,
		}))

		res.status(200).json(formattedResults)
	})
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