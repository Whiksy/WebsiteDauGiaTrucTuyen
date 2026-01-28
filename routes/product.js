const express = require('express');
const path = require('path');
const fs = require('fs');
const { sql } = require('../config/database');
const { verifyToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// --- Cấu hình Multer cho Upload ảnh ---
let upload;
try {
    const multer = require('multer');
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '../uploads/temp');
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            console.log(`💾 [Multer] Saving to: ${dir}`);
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
} catch (e) {
    console.warn('⚠️ Module "multer" chưa được cài đặt. Chức năng upload ảnh sẽ bị tắt.');
    upload = {
        array: () => (req, res, next) => next()
    };
}

// Helper: Lấy danh sách sản phẩm (Lọc theo User hoặc lấy tất cả)
router.get('/', verifyToken, async (req, res) => {
    const userId = req.userId;
    const { viewAll } = req.query; 
    
    try {
        const pool = await sql.connect();
        let result;
        
        if (viewAll === 'true') {
            // Logic cho trang chủ hoặc Admin (Lấy tất cả sản phẩm)
            result = await pool.request()
                .query(`
                    SELECT p.*, 
                    (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
                    (SELECT COUNT(*) FROM ProductImages WHERE ProductId = p.Id) as ImageCount
                    FROM Products p ORDER BY CreatedAt DESC
                `);
        } else {
            // Logic cho Seller (Chỉ lấy sản phẩm của mình)
            // Đã fix: Đổi OwnerId -> SellerId theo DB
            result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT p.*, 
                    (SELECT TOP 1 ImageUrl FROM ProductImages WHERE ProductId = p.Id ORDER BY Id ASC) as Thumbnail,
                    (SELECT COUNT(*) FROM ProductImages WHERE ProductId = p.Id) as ImageCount
                    FROM Products p WHERE SellerId = @userId ORDER BY CreatedAt DESC
                `);
        }
        const products = result.recordset.map(p => ({
            ...p,
            image: p.Thumbnail
        }));
        res.json(products);
    } catch (error) {
        console.error('/api/products GET error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Lấy chi tiết 1 sản phẩm
router.get('/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    try {
        const pool = await sql.connect();
        // Đã fix: Đổi OwnerId -> SellerId
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM Products WHERE Id = @id AND SellerId = @userId');
            
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Sản phẩm không tìm thấy hoặc bạn không có quyền' });
        
        const product = result.recordset[0];
        
        // Lấy thêm danh sách ảnh
        const imagesResult = await pool.request()
            .input('productId', sql.Int, id)
            .query('SELECT ImageUrl FROM ProductImages WHERE ProductId = @productId ORDER BY Id ASC');
            
        product.images = imagesResult.recordset.map(img => img.ImageUrl);
        
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tạo sản phẩm mới (Gán SellerId)
// Hỗ trợ upload tối đa 5 ảnh (field name: 'productImages')
router.post('/', verifyToken, authorizeRole(['Seller','Admin']), upload.array('productImages', 5), async (req, res) => {
    // req.body chứa các trường text, req.files chứa file upload
    const { name, description, price, stock, imageUrls } = req.body;
    const userId = req.userId;
    
    try {
        const pool = await sql.connect();
        // Đã fix: Đổi OwnerId -> SellerId và thêm OUTPUT INSERTED.*
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('price', sql.Decimal(18,2), price)
            .input('stock', sql.Int, stock || 1)
            .input('sellerId', sql.Int, userId)
            .query(`
                INSERT INTO Products (Name, Description, Price, Stock, SellerId) 
                OUTPUT INSERTED.* VALUES (@name, @description, @price, @stock, @sellerId)
            `);
        
        const newProduct = result.recordset[0];
        const newProductId = newProduct.Id;

        // Xử lý ảnh: Kết hợp ảnh upload và ảnh từ URL (nếu có)
        let imagesToInsert = [];
        
        // 1. Ảnh từ file upload
        if (req.files && req.files.length > 0) {
            // Tạo thư mục riêng cho sản phẩm: uploads/Product/{id}
            const productDir = path.join(__dirname, `../uploads/Product/${newProductId}`);
            if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });

            req.files.forEach(file => {
                const oldPath = file.path;
                const newPath = path.join(productDir, file.filename);
                fs.renameSync(oldPath, newPath); // Di chuyển file từ temp sang folder sản phẩm
                console.log(`💾 [Move] Đã chuyển file sang: ${newPath}`);
                imagesToInsert.push(`/uploads/Product/${newProductId}/${file.filename}`);
            });
        }

        // 2. Ảnh từ URL (nếu người dùng nhập link) - Frontend gửi dạng mảng hoặc string
        if (imageUrls) {
            const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
            imagesToInsert = [...imagesToInsert, ...urls];
        }

        // Lưu vào bảng ProductImages
        if (imagesToInsert.length > 0) {
            const table = new sql.Table('ProductImages');
            table.create = false;
            table.columns.add('ProductId', sql.Int, { nullable: false });
            table.columns.add('ImageUrl', sql.NVarChar(sql.MAX), { nullable: false });

            imagesToInsert.forEach(url => {
                table.rows.add(newProductId, url);
            });

            const request = new sql.Request(pool);
            await request.bulk(table);
        }

        res.status(201).json({ message: 'Tạo sản phẩm thành công', product: newProduct, images: imagesToInsert });
    } catch (error) {
        console.error('/api/products POST error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cập nhật thông tin sản phẩm
router.put('/:id', verifyToken, authorizeRole(['Seller','Admin']), upload.array('productImages', 5), async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock, imageUrls, keepImages } = req.body;
    const userId = req.userId;

    try {
        const pool = await sql.connect();
        const check = await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query('SELECT Id FROM Products WHERE Id = @id AND SellerId = @userId');
            
        if(check.recordset.length === 0) return res.status(403).json({message: 'Bạn không có quyền sửa sản phẩm này'});

        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('description', sql.NVarChar, description)
            .input('price', sql.Decimal(18,2), price)
            .input('stock', sql.Int, stock || 0)
            .query('UPDATE Products SET Name = @name, Description = @description, Price = @price, Stock = @stock, UpdatedAt = GETDATE() WHERE Id = @id');

        // Xử lý ảnh cũ: Nếu có gửi keepImages, xóa các ảnh không nằm trong danh sách này
        // keepImages có thể là mảng URL hoặc 1 URL string
        if (keepImages !== undefined) {
            // Xóa tất cả ảnh cũ trước
            await pool.request().input('pid', sql.Int, id).query('DELETE FROM ProductImages WHERE ProductId = @pid');
            
            // Insert lại những ảnh muốn giữ
            const keepList = (Array.isArray(keepImages) ? keepImages : [keepImages]).filter(url => url && url.trim() !== "");
            if (keepList.length > 0) {
                const table = new sql.Table('ProductImages');
                table.create = false;
                table.columns.add('ProductId', sql.Int, { nullable: false });
                table.columns.add('ImageUrl', sql.NVarChar(sql.MAX), { nullable: false });
                keepList.forEach(url => table.rows.add(id, url));
                await new sql.Request(pool).bulk(table);
            }
        }

        // Xử lý thêm ảnh mới (nếu có)
        let imagesToInsert = [];
        
        // 1. Ảnh từ file upload
        if (req.files && req.files.length > 0) {
            // Tạo thư mục riêng cho sản phẩm: uploads/Product/{id}
            const productDir = path.join(__dirname, `../uploads/Product/${id}`);
            if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });

            req.files.forEach(file => {
                const oldPath = file.path;
                const newPath = path.join(productDir, file.filename);
                fs.renameSync(oldPath, newPath);
                console.log(`💾 [Move-Edit] Đã chuyển file sang: ${newPath}`);
                imagesToInsert.push(`/uploads/Product/${id}/${file.filename}`);
            });
        }

        // 2. Ảnh từ URL
        if (imageUrls) {
            const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
            imagesToInsert = [...imagesToInsert, ...urls];
        }

        // Lưu vào bảng ProductImages
        if (imagesToInsert.length > 0) {
            const table = new sql.Table('ProductImages');
            table.create = false;
            table.columns.add('ProductId', sql.Int, { nullable: false });
            table.columns.add('ImageUrl', sql.NVarChar(sql.MAX), { nullable: false });

            imagesToInsert.forEach(url => {
                table.rows.add(id, url);
            });

            const request = new sql.Request(pool);
            await request.bulk(table);
        }

        res.json({ message: 'Cập nhật thành công', newImages: imagesToInsert });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Xóa hẳn sản phẩm (Hard Delete)
router.delete('/:id', verifyToken, authorizeRole(['Seller','Admin']), async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;
    
    try {
        const pool = await sql.connect();
        // Kiểm tra đấu giá tồn tại trước khi xóa
        const checkAuction = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT COUNT(*) as count FROM Auctions WHERE ProductId = @id');
        
        if (checkAuction.recordset[0].count > 0) {
            return res.status(400).json({ message: 'Sản phẩm đang trong phiên đấu giá, không thể xóa' });
        }
        
        await pool.request()
            .input('id', sql.Int, id)
            .input('userId', sql.Int, userId)
            .query('DELETE FROM Products WHERE Id = @id AND SellerId = @userId');
            
        res.json({ message: 'Đã xóa sản phẩm' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;