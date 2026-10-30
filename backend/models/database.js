const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Parse PostgreSQL DATE type (OID 1082) as raw string 'YYYY-MM-DD'
// to match SQLite behavior and maintain consistent REST responses
types.setTypeParser(1082, (val) => val);

const isSslDisabled = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=disable');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSslDisabled ? false : { rejectUnauthorized: false }
});

const initDB = async () => {
    if (!process.env.DATABASE_URL) {
        console.warn('[Database] DATABASE_URL is not set. Skipping schema initialization.');
        return;
    }

    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[Database] PostgreSQL schema initialized successfully.');
    } catch (err) {
        console.error('[Database] Error initializing database schema:', err.message);
    }
};

// Initialize schema on load
initDB();

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    initDB
};
