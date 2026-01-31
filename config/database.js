const sql = require('mssql');
const appSettings = require('./appsettings'); // Đảm bảo file này tồn tại và đúng cấu trúc
const util = require('util');

let lastDbLog = 0;

const connectDB = async () => {
    try {
        // Kiểm tra nếu đã kết nối thì return luôn, KHÔNG đóng kết nối cũ
        if (sql.connected || (sql.globalPool && sql.globalPool.connected)) {
            return true;
        }

        // Chỉ log "Đang kết nối" nếu không phải spam liên tục
        if (Date.now() - lastDbLog > 5000) console.log('🔄 Đang kết nối tới SQL Server...');

        const config = appSettings.ConnectionStrings.DefaultConnection;

        // Hàm này sẽ gán Pool vào biến Global của thư viện mssql
        await sql.connect(config);
        
        console.log(`✅ Đã kết nối SQL Server thành công`);
        return true;
    } catch (error) {
        const now = Date.now();
        if (now - lastDbLog > 10000) { // Chỉ log lỗi DB mỗi 10 giây
            console.error('❌ Lỗi kết nối Database (Final):');
            console.error(util.inspect(error, { showHidden: false, depth: null, colors: true }));
            lastDbLog = now;
        }
        return false;
    }
};

module.exports = { connectDB, sql };