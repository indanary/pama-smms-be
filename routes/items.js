const express = require("express")
const router = express.Router()
const connection = require("../db")
const {format} = require("date-fns")

// Create item
router.post("/", (req, res) => {
	const {
		stock_node,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body

	if (
		!stock_node ||
		!part_no ||
		!mnemonic ||
		!item_class ||
		!item_name ||
		!uoi
	) {
		return res.status(400).json({message: "All fields are required"})
	}

	const createdAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const createdBy = req.user.email

	const query =
		"INSERT INTO items (stock_node, part_no, mnemonic, class, item_name, uoi, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"

	connection.query(
		query,
		[
			stock_node,
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

// Read all items
router.get("/", (req, res) => {
	const query = "SELECT * FROM items"

	connection.query(query, (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching items", error: err})
		}
		res.status(200).json(result)
	})
})

// Read single item
router.get("/:id", (req, res) => {
	const {id} = req.params
	const query = "SELECT * FROM items WHERE id = ?"

	connection.query(query, [id], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching item", error: err})
		}
		if (result.length === 0) {
			return res.status(404).json({message: "Item not found"})
		}
		res.status(200).json(result[0])
	})
})

// Update item
router.put("/:id", (req, res) => {
	const itemId = req.params.id
	const {
		stock_node,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body

  if (
		!stock_node ||
		!part_no ||
		!mnemonic ||
		!item_class ||
		!item_name ||
		!uoi
	) {
		return res.status(400).json({message: "All fields are required"})
	}

  const lastUpdatedAt = format(new Date(), "yyyy-MM-dd HH:mm:ss")
	const lastUpdatedBy = req.user.email

	const query =
		"UPDATE items SET stock_node = ?, part_no = ?, mnemonic = ?, class = ?, item_name = ?, uoi = ?, last_updated_at = ?, last_updated_by = ? WHERE id = ?"

	connection.query(
		query,
		[stock_node, part_no, mnemonic, item_class, item_name, uoi, lastUpdatedAt, lastUpdatedBy, itemId],
		(err, result) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error updating item", error: err})
			}
			if (result.affectedRows === 0) {
				return res.status(404).json({message: "Item not found"})
			}
			res.status(200).json({message: "Item updated successfully"})
		},
	)
})

// Delete item
router.delete("/items/:id", (req, res) => {
	const itemId = req.params.id
	const query = "DELETE FROM items WHERE id = ?"

	connection.query(query, [itemId], (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error deleting item", error: err})
		}
		if (result.affectedRows === 0) {
			return res.status(404).json({message: "Item not found"})
		}
		res.status(200).json({message: "Item deleted successfully"})
	})
})

module.exports = router
