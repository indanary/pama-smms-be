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
				COALESCE(b.booking_status, '') AS booking_status,
				bi.po_number,
				bi.item_qty,
				bi.total_received_items,
				bi.item_remark,
				COALESCE(i.id, 0) AS item_id,
				COALESCE(i.stock_code, '') AS stock_code,
				COALESCE(i.part_no, '') AS part_no,
				COALESCE(i.mnemonic, '') AS mnemonic,
				COALESCE(i.class, '') AS class,
				COALESCE(i.item_name, '') AS item_name,
				COALESCE(i.uoi, '') AS uoi,
				ANY_VALUE(bp.due_date) AS due_date,
				ANY_VALUE(bp.total_qty_items) AS total_qty_items_booking,
				u1.email AS created_by_email,
				(
					SELECT COALESCE(SUM(bi2.item_qty), 0)
					FROM booking_items bi2
					WHERE bi2.booking_id = bi.booking_id
				) AS total_qty_items,
				(
					SELECT COALESCE(SUM(bi2.total_received_items), 0)
					FROM booking_items bi2
					WHERE bi2.booking_id = bi.booking_id
				) AS total_received_items_booking
			FROM booking_items bi
			LEFT JOIN bookings b ON bi.booking_id = b.id
			LEFT JOIN items i ON bi.item_id = i.id
			LEFT JOIN booking_po bp ON bi.po_number = bp.po_number AND bi.booking_id = bp.booking_id
			LEFT JOIN users u1 ON b.created_by = u1.id
			GROUP BY bi.booking_id, bi.po_number, bi.item_id, u1.email, b.description, 
					 b.requested_by, b.cn_no, b.is_removed, b.remove_reason, b.wr_no, 
					 bi.item_qty, bi.item_remark, i.id, i.stock_code, i.part_no, 
					 i.mnemonic, i.class, i.item_name, i.uoi;
		`

		const [rows] = await connection.promise().query(query)

		if (!rows || rows.length === 0) {
			console.log("No booking items found to update Google Sheets.")
			return {message: "No booking items found"}
		}

		// Function to clean up null, empty, or "Unknown" values
		const cleanValue = (value) =>
			!value || value === "Unknown" ? "" : value

		// Format data for Google Sheets
		const formattedData = rows.map((data) => {
			// Calculate received percentage per booking_id
			const receivedPercentage =
				data.total_qty_items > 0
					? (
							(data.total_received_items_booking /
								data.total_qty_items) *
							100
					  ).toFixed(2)
					: "0.00"

			return [
				`BOOKSM${data.booking_id}`,
				cleanValue(data.description),
				cleanValue(data.created_by_email),
				cleanValue(data.requested_by),
				cleanValue(data.cn_no),
				cleanValue(data.item_remark),
				cleanValue(data.po_number),
				cleanValue(data.due_date),
				`${receivedPercentage}%`, // Now matches API
				cleanValue(data.stock_code),
				cleanValue(data.part_no),
				cleanValue(data.mnemonic),
				cleanValue(data.class),
				cleanValue(data.item_name),
				cleanValue(data.uoi),
				data.item_qty,
				data.total_received_items,
				cleanValue(data.wr_no),
				data.is_removed === 0 ? "false" : "true",
				cleanValue(data.remove_reason),
				cleanValue(data.booking_status),
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
