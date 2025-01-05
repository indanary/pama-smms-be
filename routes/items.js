const express = require("express")
const router = express.Router()
const connection = require("../db")

// Create item
router.post("/items", (req, res) => {
	const {
		stock_node,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body
	const query =
		"INSERT INTO items (stock_node, part_no, mnemonic, class, item_name, uoi) VALUES (?, ?, ?, ?, ?, ?)"

	db.execute(
		query,
		[stock_node, part_no, mnemonic, item_class, item_name, uoi],
		(err, result) => {
			if (err) {
				return res
					.status(500)
					.json({message: "Error creating item", error: err})
			}
			res.status(201).json({
				message: "Item created successfully",
				itemId: result.insertId,
			})
		},
	)
})

// Read all items
router.get("/items", (req, res) => {
	const query = "SELECT * FROM items"

	db.execute(query, (err, result) => {
		if (err) {
			return res
				.status(500)
				.json({message: "Error fetching items", error: err})
		}
		res.status(200).json(result)
	})
})

// Read single item
router.get("/items/:id", (req, res) => {
	const {id} = req.params
	const query = "SELECT * FROM items WHERE id = ?"

	db.execute(query, [id], (err, result) => {
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
router.put("/items/:id", (req, res) => {
	const {id} = req.params
	const {
		stock_node,
		part_no,
		mnemonic,
		class: item_class,
		item_name,
		uoi,
	} = req.body
	const query =
		"UPDATE items SET stock_node = ?, part_no = ?, mnemonic = ?, class = ?, item_name = ?, uoi = ? WHERE id = ?"

	db.execute(
		query,
		[stock_node, part_no, mnemonic, item_class, item_name, uoi, id],
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
	const {id} = req.params
	const query = "DELETE FROM items WHERE id = ?"

	db.execute(query, [id], (err, result) => {
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

module.exports = router;