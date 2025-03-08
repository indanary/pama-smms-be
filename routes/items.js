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
			bi.total_received_items,
			bi.po_number,
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

		const formattedResults = result.map((item) => {
			return {
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
				total_received_items: item.total_received_items,
				po_number: item.po_number,
			}
		})

		res.status(200).json(formattedResults)
	})
})

// add item
router.post("/", (req, res) => {
	const {
		stock_code,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body

	// if (!stock_code)
	// 	return res.status(400).json({ message: "Stock code is required" })

	if (!part_no) return res.status(400).json({ message: "Part no is required" })

	if (!mnemonic)
		return res.status(400).json({ message: "Mnemonic is required" })

	// if (!item_class)
	// 	return res.status(400).json({ message: "Item class is required" })

	if (!item_name)
		return res.status(400).json({ message: "Item name is required" })

	if (!uoi) return res.status(400).json({ message: "UOI is required" })

	const checkStockCode = "SELECT * FROM items WHERE stock_code = ?"
	connection.query(checkStockCode, [stock_code], (err, results) => {
		if (err) {
			return res.status(500).json({ message: "Database error", error: err })
		}

		if (results.length > 0) {
			return res.status(409).json({
				message: "Item with the same stock code already exists",
			})
		}

		const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const createdBy = req.user.id

		const insertQuery = `
			INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`

		connection.query(
			insertQuery,
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
						.json({ message: "Error creating item", error: err })
				}

				const itemId = result.insertId

				const selectQuery = `
					SELECT items.id, items.stock_code, items.part_no, items.mnemonic, items.class, 
					       items.item_name, items.uoi, items.created_at, users.email AS created_by_email
					FROM items
					LEFT JOIN users ON items.created_by = users.id
					WHERE items.id = ?
				`

				connection.query(selectQuery, [itemId], (err, itemResults) => {
					if (err) {
						return res
							.status(500)
							.json({ message: "Error retrieving item", error: err })
					}

					if (itemResults.length === 0) {
						return res
							.status(500)
							.json({ message: "Item created but not found" })
					}

					const item = itemResults[0]

					res.status(201).json({
						message: "Item created successfully",
						item: {
							id: item.id,
							stock_code: item.stock_code,
							part_no: item.part_no,
							mnemonic: item.mnemonic,
							class: item.class,
							item_name: item.item_name,
							uoi: item.uoi,
							created_at: item.created_at,
							created_by: item.created_by_email,
						},
					})
				})
			}
		)
	})
})

// update item
router.put("/:id", (req, res) => {
	const { stock_code, class: item_class } = req.body
	const { id } = req.params

	// Skip if there's nothing to update
	if (!stock_code && !item_class) {
		return res.status(400).json({ message: "No fields to update" })
	}

	let updateFields = []
	let queryParams = []

	if (stock_code) {
		updateFields.push("stock_code = ?")
		queryParams.push(stock_code)
	}

	if (item_class) {
		updateFields.push("class = ?")
		queryParams.push(item_class)
	}

	const updateQuery = `UPDATE items SET ${updateFields.join(", ")} WHERE id = ?`
	queryParams.push(id)

	connection.query(updateQuery, queryParams, (err, result) => {
		if (err) {
			// Handle duplicate stock_code error (assuming MySQL error code 1062)
			if (err.code === "ER_DUP_ENTRY") {
				return res.status(409).json({ message: "Stock code already exists" })
			}
			return res.status(500).json({ message: "Error updating item", error: err })
		}

		if (result.affectedRows === 0) {
			return res.status(404).json({ message: "Item not found" })
		}

		res.status(200).json({ message: "Item updated successfully" })
	})
})

// upload item
router.post("/upload", async (req, res) => {
	const items = req.body.items

	if (!items || !Array.isArray(items) || items.length === 0) {
		return res.status(400).json({message: "Items data is required"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.id

	// Extract stock codes to check for duplicates
	const stockCodes = items.map((item) => item.stock_code)

	try {
		// Fetch existing stock codes in a single query
		const [existingItems] = await connection
			.promise()
			.query("SELECT stock_code FROM items WHERE stock_code IN (?)", [
				stockCodes,
			])

		const existingStockCodes = new Set(
			existingItems.map((row) => row.stock_code),
		)

		// Filter out items that already exist
		const newItems = items.filter(
			(item) => !existingStockCodes.has(item.stock_code),
		)

		if (newItems.length === 0) {
			return res.status(409).json({
				message: "All items already exist",
			})
		}

		// Prepare bulk insert values
		const values = newItems.map(
			({
				stock_code,
				part_no,
				mnemonic,
				class: item_class,
				item_name,
				uoi,
			}) => [
				stock_code,
				part_no,
				mnemonic,
				item_class,
				item_name,
				uoi,
				createdAt,
				createdBy,
			],
		)

		// Start a transaction for bulk insert
		await connection.promise().beginTransaction()

		const query =
			"INSERT INTO items (stock_code, part_no, mnemonic, class, item_name, uoi, created_at, created_by) VALUES ?"

		const [result] = await connection.promise().query(query, [values])

		// Commit transaction
		await connection.promise().commit()

		res.status(201).json({
			message: "Items created successfully",
			insertedCount: result.affectedRows,
		})
	} catch (error) {
		// Rollback transaction on error
		await connection.promise().rollback()
		res.status(500).json({message: "Error processing request", error})
	}
})

// update total received items
router.put("/update-received-items", async (req, res) => {
	try {
		const {booking_id, po_number, item_id, total_received_items} = req.body
		const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const lastUpdatedBy = req.user.id

		// Validate input
		if (!booking_id || !item_id) {
			return res
				.status(400)
				.json({message: "Booking ID and Item ID are required"})
		}
		if (total_received_items === undefined || total_received_items < 0) {
			return res
				.status(400)
				.json({message: "Invalid total received items"})
		}

		// Update total_received_items in booking_items based on booking_id, po_number, and item_id
		const queryUpdateBookingItems = `
			UPDATE booking_items 
			SET total_received_items = ? 
			WHERE booking_id = ? 
			AND item_id = ? 
			AND (po_number = ? OR po_number IS NULL)
		`

		await connection
			.promise()
			.query(queryUpdateBookingItems, [
				total_received_items,
				booking_id,
				item_id,
				po_number,
			])

		// Sum all total_received_items for the same booking_id in booking_items
		const querySumReceived = `
			SELECT SUM(total_received_items) AS total_sum 
			FROM booking_items 
			WHERE booking_id = ?
			AND po_number = ?
		`

		const [sumResult] = await connection
			.promise()
			.query(querySumReceived, [booking_id, po_number])
		const totalSum = sumResult[0].total_sum || 0 // Ensure it's at least 0

		// Get total_qty_items from booking_po
		const queryGetTotalQty = `
			SELECT total_qty_items 
			FROM booking_po 
			WHERE booking_id = ?
			AND po_number = ?
		`

		const [poResult] = await connection
			.promise()
			.query(queryGetTotalQty, [booking_id, po_number])

		if (poResult.length === 0) {
			return res.status(404).json({message: "Booking PO not found"})
		}

		const totalQty = poResult[0].total_qty_items

		// Determine status
		let status = "partial"
		if (Number(totalSum) === Number(totalQty)) {
			status = "completed"
		}

		// Update total_received_items and status in booking_po
		const queryUpdateBookingPo = `
			UPDATE booking_po 
			SET total_received_items = ?, status = ? 
			WHERE booking_id = ?
			AND po_number = ?
		`

		await connection
			.promise()
			.query(queryUpdateBookingPo, [
				totalSum,
				status,
				booking_id,
				po_number,
			])

		const queryUpdateBooking = `
			UPDATE bookings 
			SET last_updated_at = ?, last_updated_by = ? 
			WHERE id = ?
		`

		await connection
			.promise()
			.query(queryUpdateBooking, [
				lastUpdatedAt,
				lastUpdatedBy,
				booking_id,
			])

		res.status(200).json({
			message: "Total received items and status updated successfully",
			total_received_items_in_booking_po: totalSum,
			status: status,
		})
	} catch (error) {
		res.status(500).json({
			message: "Error updating total received items and status",
			error,
		})
	}
})

module.exports = router
