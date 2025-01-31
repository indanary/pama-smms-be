const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")
const cron = require("node-cron")

// generate notifications
const generateBookingNotifications = async () => {
	return new Promise((resolve, reject) => {
		const queryGetBookings = `
			SELECT id, description, created_at
			FROM bookings
			WHERE booking_status = 'open' AND is_removed = 0
		`

		connection.query(queryGetBookings, (err, bookings) => {
			if (err)
				return reject({message: "Error fetching bookings", error: err})

			if (bookings.length === 0)
				return resolve({
					message: "There are no open bookings to notify",
				})

			const queryUsers = `SELECT id FROM users`
			connection.query(queryUsers, (err, users) => {
				if (err)
					return reject({message: "Error fetching users", error: err})

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

				if (values.length === 0)
					return resolve({message: "No notifications to insert"})

				const queryInsertNotif = `
					INSERT INTO notifications (user_id, message, booking_id, created_at)
					VALUES ?
				`

				connection.query(queryInsertNotif, [values], (err) => {
					if (err)
						return reject({
							message: "Error inserting notifications",
							error: err,
						})

					resolve({message: "Notifications generated for all users"})
				})
			})
		})
	})
}

// Express route to trigger manually
const generateBookingNotificationsHandler = async (req, res) => {
	try {
		const result = await generateBookingNotifications()
		res.status(201).json(result)
	} catch (error) {
		res.status(500).json(error)
	}
}

// Schedule job (no req, res needed)
cron.schedule("0 9 * * 6", async () => {
	try {
		const result = await generateBookingNotificationsHandler()
	} catch (error) {
		console.error("Error in scheduled job:", error)
	}
})

// get notification
router.get("/", (req, res) => {
	const userId = req.user.id

	const query = `
      SELECT id, message, booking_id, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
  `

	connection.query(query, [userId], (err, results) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching notifications", error: err})
		}

		res.status(200).json({data: results})
	})
})

// update notification
router.put("/:id", (req, res) => {
	const {id} = req.params
	const query = "UPDATE notifications SET is_read = TRUE WHERE id = ?"

	connection.query(query, [id], (err) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error updating notification", error: err})
		}

		res.status(200).json({message: "Notification marked as read"})
	})
})

module.exports = router
