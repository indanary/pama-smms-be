const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Create item
router.post("/", (req, res) => {
	const {
		stock_code,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
		qty,
	} = req.body

	if (
		!stock_code ||
		!part_no ||
		!mnemonic ||
		!item_class ||
		!item_name ||
		!uoi ||
		!qty
	) {
		return res.status(400).json({message: "All fields are required"})
	}

	const checkStockCode = "SELECT * FROM items WHERE stock_code = ?"
	connection.query(checkStockCode, [stock_code], async (err, results) => {
		if (results.length > 0) {
			return res.status(409).json({
				message: "Item Part with the same stock code already exists",
			})
		}

		const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const createdBy = req.user.id

		const query =
			"INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"

		connection.query(
			query,
			[
				stock_code,
				part_no,
				mnemonic,
				item_class,
				item_name,
				uoi,
				createdAt,
				createdBy,
				qty,
			],
			(err, result) => {
				if (err) {
					console.log(err, "err")
					return res
						.status(500)
						.json({message: "Error creating item", error: err})
				}
				res.status(201).json({
					message: "Item created successfully",
				})
			},
		)
	})
})

router.post("/upload", (req, res) => {
	const items = req.body.items

	if (!items || !Array.isArray(items) || items.length === 0) {
		return res.status(400).json({message: "Items array is required"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	const query =
		"INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by, qty) VALUES ?"

	const values = items.map((item) => [
		item.stock_code,
		item.part_no,
		item.mnemonic,
		item.class,
		item.item_name,
		item.uoi,
		createdAt,
		createdBy,
		item.qty,
	])

	const checkStockCode = "SELECT stock_code FROM items WHERE stock_code = ?"

	// Check for duplicates before inserting
	let duplicateFound = false
	items.forEach((item, index) => {
		connection.query(checkStockCode, [item.stock_code], (err, results) => {
			if (results.length > 0) {
				duplicateFound = true
				return res.status(409).json({
					message: `Item with stock code ${item.stock_code} already exists`,
				})
			}

			// If no duplicates found, insert all items
			if (index === items.length - 1 && !duplicateFound) {
				connection.query(query, [values], (err, result) => {
					if (err) {
						return res.status(500).json({
							message: "Error creating items",
							error: err,
						})
					}
					res.status(201).json({
						message: "Items created successfully",
						insertedCount: result.affectedRows,
					})
				})
			}
		})
	})
})

// Read all items
router.get("/", (req, res) => {
	const {stock_code} = req.query

	let query = `
		SELECT i.*, 
			   u1.email AS created_by_email, 
			   u2.email AS last_updated_by_email 
		FROM items i
		LEFT JOIN users u1 ON i.created_by = u1.id
		LEFT JOIN users u2 ON i.last_updated_by = u2.id
	`

	// Add search condition if stock_code is provided
	if (stock_code) {
		query += " WHERE i.stock_code LIKE ?"
	}

	connection.query(
		query,
		[stock_code ? `%${stock_code}%` : null],
		(err, result) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error fetching items", error: err})
			}

			const formattedResults = result.map((item) => ({
				...item,
				created_by: item.created_by_email,
				last_updated_by: item.last_updated_by_email,
			}))

			res.status(200).json(formattedResults)
		},
	)
})

router.get("/booking", (req, res) => {
	const {booking_id} = req.query

	if (!booking_id) {
		return res.status(400).json({message: "Booking ID is required"})
	}

	const query = `
		SELECT i.*, 
			   u1.email AS created_by_email, 
			   u2.email AS last_updated_by_email 
		FROM booking_items bi
		JOIN items i ON bi.item_id = i.id
		LEFT JOIN users u1 ON i.created_by = u1.id
		LEFT JOIN users u2 ON i.last_updated_by = u2.id
		WHERE bi.booking_id = ? AND bi.po_id IS NULL
	`

	connection.query(query, [booking_id], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching items", error: err})
		}

		const formattedResults = result.map((item) => ({
			...item,
			created_by: item.created_by_email,
		}))

		res.status(200).json(formattedResults)
	})
})

// Read single item
router.get("/:id", (req, res) => {
	const {id} = req.params
	const query = "SELECT * FROM items WHERE id = ?"

	connection.query(query, [id], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching item", error: err})
		}
		if (result.length === 0) {
			return res.status(404).json({message: "Item not found"})
		}
		res.status(200).json(result[0])
	})
})

// Update item
router.put("/:id", (req, res) => {
	const itemId = req.params.id
	const {
		stock_code,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body

	if (
		!stock_code ||
		!part_no ||
		!mnemonic ||
		!item_class ||
		!item_name ||
		!uoi
	) {
		return res.status(400).json({message: "All fields are required"})
	}

	const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const lastUpdatedBy = req.user.email

	const query =
		"UPDATE items SET stock_code = ?, part_no = ?, mnemonic = ?, class = ?, item_name = ?, uoi = ?, last_updated_at = ?, last_updated_by = ? WHERE id = ?"

	connection.query(
		query,
		[
			stock_code,
			part_no,
			mnemonic,
			item_class,
			item_name,
			uoi,
			lastUpdatedAt,
			lastUpdatedBy,
			itemId,
		],
		(err, result) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error updating item", error: err})
			}
			if (result.affectedRows === 0) {
				return res.status(404).json({message: "Item not found"})
			}
			res.status(200).json({message: "Item updated successfully"})
		},
	)
})

// Delete item
router.delete("/items/:id", (req, res) => {
	const itemId = req.params.id
	const query = "DELETE FROM items WHERE id = ?"

	connection.query(query, [itemId], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error deleting item", error: err})
		}
		if (result.affectedRows === 0) {
			return res.status(404).json({message: "Item not found"})
		}
		res.status(200).json({message: "Item deleted successfully"})
	})
})

module.exports = router
