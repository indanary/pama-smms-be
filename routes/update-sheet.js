const cron = require("node-cron")
const {updateSheet} = require("../update-sheet")
const connection = require("../db")

// Function to fetch booking items and update Google Sheets
const fetchAndUpdateBookingItems = async () => {
	try {
		const query = `
      SELECT
        bi.booking_id,
        COALESCE(b.description, 'No Description') AS description,
        COALESCE(b.cn_no, 'No CN No') AS cn_no,
				COALESCE(b.is_removed, 0) AS is_removed,
        bi.po_number,
        bi.item_qty,
        bi.total_received_items,
        COALESCE(i.id, 0) AS item_id,
        COALESCE(i.stock_code, 'Unknown') AS stock_code,
        COALESCE(i.part_no, 'Unknown') AS part_no,
        COALESCE(i.mnemonic, 'Unknown') AS mnemonic,
        COALESCE(i.class, 'Unknown') AS class,
        COALESCE(i.item_name, 'Unknown') AS item_name,
        COALESCE(i.uoi, 'Unknown') AS uoi,
        COALESCE(bp.due_date, '') AS due_date
      FROM booking_items bi
      LEFT JOIN bookings b ON bi.booking_id = b.id
      LEFT JOIN items i ON bi.item_id = i.id
      LEFT JOIN booking_po bp ON bi.po_number = bp.po_number;
    `

		const [rows] = await connection.promise().query(query)

		if (!rows || rows.length === 0) {
			console.log("No booking items found to update Google Sheets.")
			return
		}

		// Format data for Google Sheets
		const formattedData = rows.map((data) => [
			`BOOKSM${data.booking_id}`,
			data.description,
			data.cn_no,
			data.po_number === null ? "" : data.po_number,
			data.due_date,
			data.stock_code,
			data.part_no,
			data.mnemonic,
			data.class,
			data.item_name,
			data.uoi,
			data.item_qty,
			data.total_received_items,
			data.is_removed === 0 ? 'false' : 'true'
		])

		// Update Google Sheet
		await updateSheet(formattedData)

		console.log("Booking items updated in Google Sheets successfully!")
	} catch (error) {
		console.error("Error fetching or updating booking items:", error)
	}
}

// **Manual API trigger**
const fetchBookingItemsHandler = async (req, res) => {
	try {
		const result = await fetchAndUpdateBookingItems()
		res.status(201).json(result)
	} catch (error) {
		res.status(500).json({message: "Error updating booking items", error})
	}
}

// **Schedule job: Runs every day at 8 AM, 1 PM, and 4 PM**
cron.schedule("0 8,13,16 * * *", async () => {
	try {
		await fetchAndUpdateBookingItems()
	} catch (error) {
		console.error("Error in scheduled job:", error)
	}
})

module.exports = {fetchBookingItemsHandler}
