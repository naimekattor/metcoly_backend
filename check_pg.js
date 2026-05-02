require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const apps = await pool.query('SELECT count(*) FROM applications');
    const bookings = await pool.query('SELECT count(*) FROM bookings');
    const users = await pool.query('SELECT count(*) FROM users');
    
    console.log('--- Database Check ---');
    console.log('Applications:', apps.rows[0].count);
    console.log('Bookings:', bookings.rows[0].count);
    console.log('Users:', users.rows[0].count);
    
    if (parseInt(apps.rows[0].count) > 0) {
      const sampleApps = await pool.query('SELECT * FROM applications LIMIT 2');
      console.log('Sample Applications:', JSON.stringify(sampleApps.rows, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

check();
