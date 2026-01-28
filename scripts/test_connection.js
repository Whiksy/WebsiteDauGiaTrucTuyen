const sql = require('mssql/msnodesqlv8');

async function test() {
    const configs = [
        { name: 'LOCALHOST', server: 'localhost' },
        { name: 'DOT (.)', server: '.' },
        { name: 'SQLEXPRESS', server: '.\\SQLEXPRESS' }
    ];

    console.log('--- BẮT ĐẦU KIỂM TRA KẾT NỐI ---');

    for (const cfg of configs) {
        console.log(`\nTesting: ${cfg.name} ...`);
        try {
            await sql.connect({
                server: cfg.server,
                database: 'AuctionDB',
                driver: 'msnodesqlv8',
                options: { trustedConnection: true, trustServerCertificate: true }
            });
            console.log(`✅ KẾT NỐI THÀNH CÔNG VỚI: ${cfg.name}`);
            const res = await sql.query('SELECT @@VERSION as version');
            console.log('Version:', res.recordset[0].version.split('\n')[0]);
            process.exit(0); // Thoát ngay khi thành công
        } catch (err) {
            console.log(`❌ Thất bại [${cfg.name}]:`);
            console.dir(err, { depth: null });
            await sql.close();
        }
    }
    console.log('\n❌ KHÔNG THỂ KẾT NỐI VỚI BẤT KỲ CẤU HÌNH NÀO.');
}

test();