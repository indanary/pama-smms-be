const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// get list
router.get("/", (req, res) => {
	const {search, page = 1, limit = 10} = req.query

	// Query to get total count of matching rows
	let countQuery = `
    SELECT COUNT(*) as total
    FROM items i
    LEFT JOIN users u1 ON i.created_by = u1.id
  `

	if (search) {
		countQuery += `
      WHERE i.stock_code LIKE ?
        OR i.part_no LIKE ?
        OR i.item_name LIKE ?
    `
	}

	// Query to get paginated results
	let dataQuery = `
    SELECT i.*,
        u1.email AS created_by_email
    FROM items i
    LEFT JOIN users u1 ON i.created_by = u1.id
  `

	if (search) {
		dataQuery += `
      WHERE i.stock_code LIKE ?
        OR i.part_no LIKE ?
        OR i.item_name LIKE ?
    `
	}

	// Calculate OFFSET
	const offset = (page - 1) * limit
	dataQuery += `
    LIMIT ? OFFSET ?
  `

	const searchParams = search
		? [`%${search}%`, `%${search}%`, `%${search}%`]
		: []

	// Execute the count query
	connection.query(countQuery, searchParams, (err, countResult) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching items count", error: err})
		}

		const totalItems = countResult[0].total
		const totalPages = Math.ceil(totalItems / limit)

		// Execute the data query
		connection.query(
			dataQuery,
			[...searchParams, parseInt(limit), parseInt(offset)],
			(err, result) => {
				if (err) {
					return res
						.status(500)
						.json({message: "Error fetching items", error: err})
				}

				const formattedResults = result.map((item) => ({
					id: item.id,
					stock_code: item.stock_code,
					part_no: item.part_no,
					mnemonic: item.mnemonic,
					class: item.class,
					item_name: item.item_name,
					uoi: item.uoi,
					created_at: item.created_at,
					created_by: item.created_by_email,
				}))

				res.status(200).json({
					page: parseInt(page),
					limit: parseInt(limit),
					totalItems,
					totalPages,
					data: formattedResults,
				})
			},
		)
	})
})

// Get list of booking items with quantity
router.get("/:id/booking", (req, res) => {
	const {id} = req.params
	const {search, options} = req.query

	// Base query to get items and their quantities linked to a booking
	let query = `
		SELECT i.*,
			bi.item_qty,
			u1.email AS created_by_email
		FROM booking_items bi
		JOIN items i ON bi.item_id = i.id
		LEFT JOIN users u1 ON i.created_by = u1.id
		WHERE bi.booking_id = ?
	`

	// Add search condition if provided
	if (search) {
		query += `
			AND (
				i.stock_code LIKE ?
				OR i.part_no LIKE ?
				OR i.item_name LIKE ?
			)
		`
	}

	// Add condition to check if po_number is null when options is provided
	if (options) {
		query += `
			AND bi.po_number IS NULL
		`
	}

	// Prepare query parameters based on conditions
	const queryParams = search
		? [id, `%${search}%`, `%${search}%`, `%${search}%`]
		: [id]

	// Execute query with parameters
	connection.query(query, queryParams, (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching items", error: err})
		}

		const formattedResults = result.map((item) => ({
			id: item.id,
			stock_code: item.stock_code,
			part_no: item.part_no,
			mnemonic: item.mnemonic,
			class: item.class,
			item_name: item.item_name,
			uoi: item.uoi,
			item_qty: item.item_qty,
			created_at: item.created_at,
			created_by: item.created_by_email,
		}))

		res.status(200).json(formattedResults)
	})
})

// add item
router.post("/", (req, res) => {
	const {stock_code, part_no, mnemonic, item_class, item_name, uoi} = req.body

	if (!stock_code)
		return res.status(400).json({message: "Stock code are required"})

	if (!part_no) return res.status(400).json({message: "Part no are required"})

	if (!mnemonic)
		return res.status(400).json({message: "Mnemonic are required"})

	if (!item_class)
		return res.status(400).json({message: "Item class are required"})

	if (!item_name)
		return res.status(400).json({message: "Item name are required"})

	if (!uoi) return res.status(400).json({message: "UOI name are required"})

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
			"INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"

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
			],
			(err, result) => {
				if (err) {
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

// upload item
router.post("/upload", (req, res) => {
	const items = req.body.items

	if (!items || !Array.isArray(items) || items.length === 0) {
		return res.status(400).json({message: "Items data is required"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	const query =
		"INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by) VALUES ?"

	const values = []

	// Validate each item
	for (const item of items) {
		const {
			stock_code,
			part_no,
			mnemonic,
			class: item_class,
			item_name,
			uoi,
		} = item

		if (!stock_code) {
			return res.status(400).json({message: "Stock code is required"})
		}
		if (!part_no) {
			return res.status(400).json({message: "Part no is required"})
		}
		if (!mnemonic) {
			return res.status(400).json({message: "Mnemonic is required"})
		}
		if (!item_class) {
			return res.status(400).json({message: "Item class is required"})
		}
		if (!item_name) {
			return res.status(400).json({message: "Item name is required"})
		}
		if (!uoi) {
			return res.status(400).json({message: "UOI is required"})
		}

		values.push([
			stock_code,
			part_no,
			mnemonic,
			item_class,
			item_name,
			uoi,
			createdAt,
			createdBy,
		])
	}

	// Check for duplicates
	let duplicateFound = false
	items.forEach((item, index) => {
		connection.query(
			"SELECT stock_code FROM items WHERE stock_code = ?",
			[item.stock_code],
			(err, results) => {
				if (err) {
					return res
						.status(500)
						.json({message: "Database error", error: err})
				}
				if (results.length > 0) {
					duplicateFound = true
					return res.status(409).json({
						message: `Item with stock code ${item.stock_code} already exists`,
					})
				}

				// If no duplicates found and it's the last item, insert all items
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
			},
		)
	})
})

module.exports = router
