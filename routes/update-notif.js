const express = require("express")
const router = express.Router()
const connection = require("../db")
const { format } = require("date-fns")

// Function to generate notifications
const generateBookingNotifications = async () => {
	try {
		// Get open bookings
		const [bookings] = await connection.promise().query(`
			SELECT id, description, created_at
			FROM bookings
			WHERE booking_status = 'open' AND is_removed = 0
		`)

		if (bookings.length === 0) {
			return { message: "There are no open bookings to notify" }
		}

		// Get all users
		const [users] = await connection.promise().query(`SELECT id FROM users`)

		const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
		const values = []

		users.forEach((user) => {
			bookings.forEach((booking) => {
				values.push([
					user.id,
					`Booking BOOKSM${booking.id} is currently still open`,
					booking.id,
					createdAt,
				])
			})
		})

		if (values.length === 0) {
			return { message: "No notifications to insert" }
		}

		// Insert notifications into DB
		await connection.promise().query(`
			INSERT INTO notifications (user_id, message, booking_id, created_at) VALUES ?
		`, [values])

		console.log("Notifications generated successfully!")
		return { message: "Notifications generated for all users" }
	} catch (error) {
		console.error("Error generating notifications:", error)
		throw error
	}
}

// **API Route to Trigger Notifications Manually**
router.post("/generate", async (req, res) => {
	try {
		const result = await generateBookingNotifications()
		res.status(201).json(result)
	} catch (error) {
		res.status(500).json({ message: "Error generating notifications", error })
	}
})

module.exports = router
