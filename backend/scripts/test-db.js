const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

async function testConnection() {
    console.log('--- PostgreSQL Connection Test ---');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ Error: DATABASE_URL is not defined in backend/.env');
        console.error('Please add your Neon connection string to backend/.env:');
        console.error('DATABASE_URL=postgres://user:password@host/dbname?sslmode=require');
        process.exit(1);
    }

    // Mask credentials in logged URL
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connecting to: ${maskedUrl}`);

    const isSslDisabled = databaseUrl.includes('sslmode=disable');
    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: isSslDisabled ? false : { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name, version() as pg_version');
        const row = res.rows[0];
        console.log('✅ Connection successful!');
        console.log(`- Connected Database: ${row.db_name}`);
        console.log(`- Server Time (UTC):   ${row.current_time}`);
        console.log(`- Version:             ${row.pg_version.split(' on ')[0]}`);
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testConnection();
