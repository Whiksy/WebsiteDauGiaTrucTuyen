const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const appsettings = require('../config/appsettings');

(async () => {
  try {
    const file = path.join(__dirname, '..', 'database', 'AuctionDB.sql');
    const sqlText = fs.readFileSync(file, 'utf8');

    // Split batches by GO on its own line
    const batches = sqlText.split(/^GO$/im);

    // Sử dụng chuỗi kết nối từ appsettings
    const config = appsettings.ConnectionStrings.DefaultConnection;

    console.log('Connecting to database...');
    await sql.connect(config);

    for (const batch of batches) {
      const trimmed = batch.trim();
      if (!trimmed) continue;
      console.log('Running batch...');
      try {
        await sql.query(trimmed);
      } catch (e) {
        console.error('Batch failed:', e && (e.message || e));
        // continue to attempt remaining batches
      }
    }

    console.log('Migration finished.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err && (err.stack || err));
    process.exit(1);
  }
})();