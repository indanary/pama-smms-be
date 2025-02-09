const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")
const XLSX = require("xlsx")
const cron = require("node-cron")
// const {updateSheet} = require("../update-sheet")

// get list
router.get("/", (req, res) => {
	const {search, page = 1, limit = 10} = req.query
	const offset = (page - 1) * limit

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
	const searchQuery = search ? ` AND (b.id = ? OR bi.po_number LIKE ?)` : ""
	queryListBooking += searchQuery
	queryListBooking += ` GROUP BY b.id LIMIT ? OFFSET ?`

	const queryTotalCount = `
		SELECT COUNT(DISTINCT b.id) AS total
		FROM bookings b
		LEFT JOIN booking_items bi ON b.id = bi.booking_id
		WHERE b.is_removed = 0 ${search ? "AND (b.id = ? OR bi.po_number LIKE ?)" : ""}
	`

	// Query parameters
	const queryParams = search
		? [search, `%${search}%`, parseInt(limit), parseInt(offset)]
		: [parseInt(limit), parseInt(offset)]

	const totalCountParams = search ? [search, `%${search}%`] : []

	// Get the total count of items
	connection.query(queryTotalCount, totalCountParams, (err, countResults) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching count", error: err})
		}

		const totalItems = countResults[0].total
		const totalPages = Math.ceil(totalItems / limit)

		// Get the paginated data
		connection.query(queryListBooking, queryParams, (err, results) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error fetching bookings", error: err})
			}

			const formattedResults = results.map((booking) => {
				const createdAt = new Date(booking.created_at)
				const today = new Date()
				let aging = 0

				if (booking.booking_status !== "closed") {
					aging = Math.floor(
						(today - createdAt) / (1000 * 60 * 60 * 24),
					)
				}

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
					aging: aging,
				}
			})

			res.status(200).json({
				page: parseInt(page),
				limit: parseInt(limit),
				totalItems,
				totalPages,
				data: formattedResults,
			})
		})
	})
})

// Function to fetch booking items and update Google Sheets
// const fetchAndUpdateBookingItems = async () => {
// 	try {
// 		const query = `
// 			SELECT
// 				bi.booking_id,
// 				COALESCE(b.description, 'No Description') AS description,
// 				COALESCE(b.cn_no, 'No CN No') AS cn_no,
// 				bi.po_number,
// 				bi.item_qty,
// 				bi.total_received_items,
// 				COALESCE(i.id, 0) AS item_id,
// 				COALESCE(i.stock_code, 'Unknown') AS stock_code,
// 				COALESCE(i.part_no, 'Unknown') AS part_no,
// 				COALESCE(i.mnemonic, 'Unknown') AS mnemonic,
// 				COALESCE(i.class, 'Unknown') AS class,
// 				COALESCE(i.item_name, 'Unknown') AS item_name,
// 				COALESCE(i.uoi, 'Unknown') AS uoi
// 			FROM booking_items bi
// 			LEFT JOIN bookings b ON bi.booking_id = b.id
// 			LEFT JOIN items i ON bi.item_id = i.id
// 		`;

// 		const [rows] = await connection.promise().query(query);

// 		if (!rows || rows.length === 0) {
// 			console.log("No booking items found to update Google Sheets.");
// 			return;
// 		}

// 		// Format data for Google Sheets
// 		const formattedData = rows.map((data) => [
// 			`BOOKSM${data.booking_id}`,
// 			data.description,
// 			data.cn_no,
// 			data.po_number === null ? "" : data.po_number,
// 			data.stock_code,
// 			data.part_no,
// 			data.mnemonic,
// 			data.class,
// 			data.item_name,
// 			data.uoi,
// 			data.item_qty,
// 			data.total_received_items,
// 		]);

// 		// Update Google Sheet
// 		await updateSheet(formattedData);

// 		console.log("Booking items updated in Google Sheets successfully!");
// 	} catch (error) {
// 		console.error("Error fetching or updating booking items:", error);
// 	}
// };

// **Manual API trigger**
const fetchBookingItemsHandler = async (req, res) => {
	try {
		const result = await fetchAndUpdateBookingItems()
		res.status(201).json(result)
	} catch (error) {
		res.status(500).json({message: "Error updating booking items", error})
	}
}

// **Schedule job: Runs every Saturday at 9 AM**
cron.schedule("0 8 * * *", async () => {
	try {
		const result = await fetchBookingItemsHandler()
	} catch (error) {
		console.error("Error in scheduled job:", error)
	}
})

// export booking
router.get("/export", (req, res) => {
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
			GROUP BY b.id
	`

	connection.query(queryListBooking, (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching bookings", error: err})
		}

		// Format data
		const formattedResults = results.map((booking) => {
			const createdAt = new Date(booking.created_at)
			const today = new Date()
			let aging = 0

			if (booking.booking_status !== "closed") {
				aging = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24))
			}

			return {
				ID: "BOOKSM" + booking.id,
				Description: booking.description,
				"CN No": booking.cn_no,
				"Approved Status": booking.approved_status ? true : false,
				"Booking Status": booking.booking_status,
				"Aging (Days)": aging,
				"PO Numbers": booking.po_numbers
					? booking.po_numbers.split(",").join(", ")
					: "",
				"Received Date": booking.received_date,
				Received: booking.received ? true : false,
				"WR No": booking.wr_no,
				"Posting WR": booking.posting_wr ? true : false,
				"Created At": booking.created_at,
				"Created By": booking.created_by_email,
				"Last Updated At": booking.last_updated_at,
				"Last Updated By": booking.last_updated_by_email ?? "",
				// "Is Removed": booking.is_removed,
				// "Remove Reason": booking.remove_reason,
			}
		})

		// Create a new workbook and worksheet
		const workbook = XLSX.utils.book_new()
		const worksheet = XLSX.utils.json_to_sheet(formattedResults)
		XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings")

		// Write to buffer and send response
		const buffer = XLSX.write(workbook, {type: "buffer", bookType: "xlsx"})
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=bookings.xlsx",
		)
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		)
		res.send(buffer)
	})
})

// get list booking po
router.get("/:bookingId/po", async (req, res) => {
	try {
		const {bookingId} = req.params

		// Validate bookingId
		if (!bookingId) {
			return res.status(400).json({message: "Booking ID is required"})
		}

		// Query to fetch booking_po records
		const queryBookingPo = `
			SELECT booking_id, po_number, created_at, created_by, status, due_date, total_qty_items, total_received_items
			FROM booking_po
			WHERE booking_id = ?
		`

		// Fetch booking_po data
		const [bookingPoRows] = await connection
			.promise()
			.query(queryBookingPo, [bookingId])

		// Check if no data found
		if (bookingPoRows.length === 0) {
			return res
				.status(404)
				.json({message: "No PO data found for this booking ID"})
		}

		// Query to fetch item details based on booking_id and po_number
		const queryItems = `
			SELECT 
				bi.booking_id, 
				bi.po_number, 
				i.id, 
				i.item_name, 
				bi.item_qty, 
				i.part_no, 
				i.stock_code
			FROM booking_items bi
			JOIN items i ON bi.item_id = i.id
			WHERE bi.booking_id = ?
		`

		// Fetch item data
		const [itemsRows] = await connection
			.promise()
			.query(queryItems, [bookingId])

		// Organize item data by booking_id and po_number
		const itemsMap = {}
		itemsRows.forEach((row) => {
			const key = `${row.booking_id}-${row.po_number}`
			if (!itemsMap[key]) {
				itemsMap[key] = []
			}
			itemsMap[key].push({
				id: row.id,
				item_name: row.item_name,
				item_qty: row.item_qty,
				part_no: row.part_no,
				stock_code: row.stock_code,
			})
		})

		// Merge item details into booking_po response
		const responseData = bookingPoRows.map((po) => ({
			...po,
			items: itemsMap[`${po.booking_id}-${po.po_number}`] || [], // Attach item details or empty array
		}))

		// Send response
		res.status(200).json(responseData)
	} catch (error) {
		res.status(500).json({message: "Error fetching PO data", error})
	}
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

		const createdAt = new Date(results[0].created_at)
		const today = new Date()
		const aging = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24))

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
			aging: aging,

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

// delete bookings
router.put("/:id/delete", (req, res) => {
	const {id} = req.params
	const {remove_reason} = req.body

	// Update query to set is_removed to true and insert remove_reason in the bookings table
	const updateBookingsQuery = `
		UPDATE bookings 
		SET is_removed = 1, remove_reason = ? 
		WHERE id = ?
	`

	// Update query to set is_removed to true in the booking_items table
	const updateBookingItemsQuery = `
		UPDATE booking_items 
		SET is_removed = 1 
		WHERE booking_id = ?
	`

	// Update query to set is_removed to true in the booking_po table
	const updateBookingPoQuery = `
		UPDATE booking_po 
		SET is_removed = 1 
		WHERE booking_id = ?
	`

	// Execute all queries in sequence
	connection.query(updateBookingsQuery, [remove_reason, id], (err) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error updating bookings", error: err})
		}

		connection.query(updateBookingItemsQuery, [id], (err) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error updating booking items", error: err})
			}

			connection.query(updateBookingPoQuery, [id], (err) => {
				if (err) {
					return res.status(500).json({
						message: "Error updating booking po",
						error: err,
					})
				}

				res.status(200).json({message: "Booking deleted successfully"})
			})
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
