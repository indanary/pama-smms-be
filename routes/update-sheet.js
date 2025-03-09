const express = require("express")
const router = express.Router()
const connection = require("../db")
const {updateSheet} = require("../update-sheet")

// Function to fetch booking items and update Google Sheets
const fetchAndUpdateBookingItems = async () => {
	try {
		const query = `
      SELECT
					bi.booking_id,
					COALESCE(b.description, '') AS description,
					COALESCE(b.requested_by, '') AS requested_by,
					COALESCE(b.cn_no, '') AS cn_no,
					COALESCE(b.is_removed, 0) AS is_removed,
					COALESCE(b.remove_reason, '') AS remove_reason,
					COALESCE(b.wr_no, '') AS wr_no,
					bi.po_number,
					bi.item_qty,
					bi.item_remark,
					COALESCE(bp.total_qty_items, 0) AS total_qty_items,
					COALESCE(bp.total_received_items, 0) AS total_received_items,
					COALESCE(i.id, 0) AS item_id,
					COALESCE(i.stock_code, '') AS stock_code,
					COALESCE(i.part_no, '') AS part_no,
					COALESCE(i.mnemonic, '') AS mnemonic,
					COALESCE(i.class, '') AS class,
					COALESCE(i.item_name, '') AS item_name,
					COALESCE(i.uoi, '') AS uoi,
					COALESCE(bp.due_date, '') AS due_date,
					u1.email AS created_by_email
			FROM booking_items bi
			LEFT JOIN bookings b ON bi.booking_id = b.id
			LEFT JOIN items i ON bi.item_id = i.id
			LEFT JOIN booking_po bp ON bi.po_number = bp.po_number AND bi.booking_id = bp.booking_id
			LEFT JOIN users u1 ON b.created_by = u1.id;
    `

		const [rows] = await connection.promise().query(query)

		if (!rows || rows.length === 0) {
			console.log("No booking items found to update Google Sheets.")
			return {message: "No booking items found"}
		}

		// Function to clean up null, empty, or "Unknown" values
		const cleanValue = (value) => (!value || value === "Unknown" ? "" : value)

		// Format data for Google Sheets
		const formattedData = rows.map((data) => {
			const receivedPercentage =
				data.total_qty_items > 0
					? ((data.total_received_items / data.total_qty_items) * 100).toFixed(2)
					: 0

			return [
				`BOOKSM${data.booking_id}`,
				cleanValue(data.description),
				cleanValue(data.created_by_email),
				cleanValue(data.requested_by),
				cleanValue(data.cn_no),
				cleanValue(data.item_remark),
				cleanValue(data.po_number),
				cleanValue(data.due_date),
				`${receivedPercentage}%`, // Received percentage from booking_po
				cleanValue(data.stock_code), // Cleaned stock_code value
				cleanValue(data.part_no),
				cleanValue(data.mnemonic),
				cleanValue(data.class),
				cleanValue(data.item_name),
				cleanValue(data.uoi),
				data.item_qty,
				data.total_received_items,
				cleanValue(data.wr_no),
				data.is_removed === 0 ? "false" : "true",
				cleanValue(data.remove_reason)
			]
		})

		// Update Google Sheet
		await updateSheet(formattedData)

		console.log("Booking items updated in Google Sheets successfully!")
		return {message: "Booking spreadsheet updated successfully"}
	} catch (error) {
		console.error("Error fetching or updating booking items:", error)
		throw error
	}
}


// API endpoint to trigger the update
router.post("/generate", async (req, res) => {
	try {
		const result = await fetchAndUpdateBookingItems()
		res.status(200).json(result)
	} catch (error) {
		res.status(500).json({
			message: "Error updating booking items",
			error: error.message,
		})
	}
})

module.exports = router
