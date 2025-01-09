const express = require('express');
const cors = require('cors');

const tokenMiddlewares = require('./middlewares/token');

const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const bookingRoutes = require('./routes/bookings');

const app = express();
const port = 3001;

// Middleware to parse JSON
app.use(express.json());

// todo: add config for cors
app.use(cors())

// Use the routes
app.use('/auth', authRoutes);
app.use('/users', tokenMiddlewares, userRoutes);
app.use('/items', tokenMiddlewares, itemRoutes);
app.use('/bookings', tokenMiddlewares, bookingRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});