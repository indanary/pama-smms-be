const express = require("express")
const router = express.Router()
const connection = require("../db")

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
