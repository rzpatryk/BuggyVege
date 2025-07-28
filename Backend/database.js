const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Maupa2++',
    database: process.env.DB_NAME || 'buggyvege',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    //acquireTimeout: 60000,
    //timeout: 60000,
    //reconnect: true
});

// Test połączenia
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Połączono z MySQL pomyślnie');
        connection.release();
    } catch (error) {
        console.error('❌ Błąd połączenia z MySQL:', error.message);
    }
};

module.exports = {testConnection };