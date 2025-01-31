const express = require("express")
const cors = require("cors")

const tokenMiddlewares = require("./middlewares/token")

const userRoutes = require("./routes/user")
const authRoutes = require("./routes/auth")
const itemRoutes = require("./routes/items")
const bookingRoutes = require("./routes/bookings")
const poRoutes = require("./routes/pos")
const notificationRoutes = require("./routes/notifications")

const app = express()
const port = 3001

// todo: add config for cors
app.use(cors())

// increase the body size limit
app.use(express.json({limit: "50mb"}))
app.use(express.urlencoded({limit: "50mb", extended: true}))

// Middleware to parse JSON
app.use(express.json())

// Use the routes
app.use("/auth", authRoutes)
app.use("/users", tokenMiddlewares, userRoutes)
app.use("/items", tokenMiddlewares, itemRoutes)
app.use("/bookings", tokenMiddlewares, bookingRoutes)
app.use("/pos", tokenMiddlewares, poRoutes)
app.use("/notifications", tokenMiddlewares, notificationRoutes)

app.listen(port, () => {})
