const express = require('express');

const tokenMiddlewares = require('./middlewares/token');

const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');

const app = express();
const port = 3001;

// Middleware to parse JSON
app.use(express.json());

// Use the routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/items', tokenMiddlewares, itemRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});