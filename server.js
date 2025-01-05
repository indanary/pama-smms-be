const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
const port = 3001;

// Middleware to parse JSON
app.use(bodyParser.json());

// MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'indanarishi1',
  database: 'pama_improvement'
});

connection.connect((err) => {
  if (err) {
    console.error('Database connection error:', err);
    return;
  }
  console.log('Connected to the database');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
