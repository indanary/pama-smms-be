const express = require('express');
const bodyParser = require('body-parser');

const userRoutes = require('./routes/user');

const app = express();
const port = 3001;

// Middleware to parse JSON
app.use(bodyParser.json());

// Use the routes
app.use('/users', userRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});