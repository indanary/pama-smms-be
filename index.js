const mysql = require('mysql2');

// Create a connection to the database
const connection = mysql.createConnection({
  host: 'localhost',        // Replace with your database host
  user: 'root',             // Replace with your database user
  password: 'indanarishi1', // Replace with your database password
  database: 'pama_improvement'  // Replace with your database name
});

// Connect to the database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the MySQL database.');
});

// Query the database
connection.query('SELECT 1 + 1 AS solution', (err, results) => {
  if (err) {
    console.error('Error executing query:', err);
    return;
  }
  console.log('The solution is: ', results[0].solution);
});

// Close the connection
connection.end();
