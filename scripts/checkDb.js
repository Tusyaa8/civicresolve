/**
 * Database Verification Script
 * Prints the total complaint count and the 5 most recent complaints.
 * Never prints connection strings, secrets, or image_data.
 */

const { query, pool } = require('../src/db/pool');

async function checkDatabase() {
  try {
    // 1. Total count
    const countResult = await query('SELECT COUNT(*) AS total FROM complaints;');
    const totalComplaints = parseInt(countResult.rows[0].total, 10);

    console.log('====================================================');
    console.log(`CivicResolve Database Status: ${totalComplaints} total complaint(s)`);
    console.log('====================================================');

    if (totalComplaints === 0) {
      console.log('No complaints found in the database yet.');
      return;
    }

    // 2. Last 5 complaints (excluding image_data and sensitive data)
    const recentResult = await query(`
      SELECT 
        tracking_id, 
        title, 
        status, 
        created_at
      FROM complaints 
      ORDER BY created_at DESC 
      LIMIT 5;
    `);

    console.log('Last 5 Complaints:');
    console.log('----------------------------------------------------');
    
    recentResult.rows.forEach((row, idx) => {
      const formattedDate = new Date(row.created_at).toLocaleString();
      console.log(
        `#${idx + 1} | [${row.tracking_id}] | Status: ${row.status.padEnd(11)} | Date: ${formattedDate}`
      );
      console.log(`    Title: "${row.title}"`);
      console.log('----------------------------------------------------');
    });

  } catch (err) {
    console.error('Error querying database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

checkDatabase();
