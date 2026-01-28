const sql = require('mssql');
const config = require('../config/appsettings');

(async () => {
  try {
    await sql.connect(config.ConnectionStrings.DefaultConnection);
    const res = await sql.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
    console.log('Tables:', res.recordset.map(t => t.TABLE_NAME));
    const users = await sql.query('SELECT Id, Email, Name FROM Users');
    console.log('Users:', users.recordset);
    const roles = await sql.query('SELECT * FROM Roles');
    console.log('Roles:', roles.recordset);
    const userRoles = await sql.query('SELECT * FROM UserRoles');
    console.log('UserRoles:', userRoles.recordset);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();