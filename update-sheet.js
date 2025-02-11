require("dotenv").config()
const {google} = require("googleapis")

if (!process.env.GOOGLE_CREDENTIALS) {
	throw new Error("GOOGLE_CREDENTIALS is not set in the environment.")
}

const keys = JSON.parse(process.env.GOOGLE_CREDENTIALS)

const auth = new google.auth.GoogleAuth({
	credentials: keys,
	scopes: ["https://www.googleapis.com/auth/spreadsheets"],
})

// Helper function to convert column number to letter (A, B, C... AA, AB)
function getColumnLetter(colNum) {
	let letter = ""
	while (colNum > 0) {
		let remainder = (colNum - 1) % 26
		letter = String.fromCharCode(65 + remainder) + letter
		colNum = Math.floor((colNum - 1) / 26)
	}
	return letter
}

// Function to update Google Sheets
async function updateSheet(data) {
	try {
		if (!Array.isArray(data) || data.length === 0) {
			throw new Error("Invalid data format. Expected an array of arrays.")
		}

		const sheets = google.sheets({version: "v4", auth})
		const spreadsheetId = "1Uhh0lsV2HIodHTAUw1ogMQRZTzKFDcULyKay095odrY" // Replace with actual ID

		// Determine the range dynamically
		const startCell = "A2" // Starting position
		const numRows = data.length
		const numCols = data[0].length

		const startColumn = startCell.replace(/[0-9]/g, "")
		const startRow = parseInt(startCell.replace(/\D/g, ""))
		const endColumn = getColumnLetter(
			startColumn.charCodeAt(0) - 64 + numCols - 1,
		)
		const endRow = startRow + numRows - 1
		const range = `Sheet1!${startColumn}${startRow}:${endColumn}${endRow}`

		// Write to Google Sheets
		await sheets.spreadsheets.values.update({
			spreadsheetId,
			range,
			valueInputOption: "RAW",
			requestBody: {values: data},
		})
	} catch (error) {
		console.error("Error updating Google Sheet:", error)
	}
}

module.exports = {updateSheet}
