const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const { sql } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const appSettings = require('../config/appsettings');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || appSettings.Jwt.Secret;

// --- Cấu hình Multer cho Upload Avatar (Giống user.js) ---
let upload;
try {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, '../uploads/avatars');
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
        }
    });
    upload = multer({ storage: storage });
} catch (e) {
    console.warn('⚠️ Module "multer" chưa được cài đặt. Upload ảnh sẽ không hoạt động.');
    upload = { single: () => (req, res, next) => next() };
}

// --- Cấu hình Nodemailer ---
const transporter = nodemailer.createTransport({
    host: appSettings.Gmail.SmtpServer,
    port: appSettings.Gmail.Port,
    secure: false, // true for 465, false for other ports
    auth: {
        user: appSettings.Gmail.Username,
        pass: appSettings.Gmail.Password
    }
});

// Register
router.post('/register', upload.single('avatar'), async (req, res) => {
  const { email, password, name, role } = req.body;
  let avatarUrl = null;

  // Nếu có file upload, dùng đường dẫn file
  if (req.file) {
      avatarUrl = `/uploads/avatars/${req.file.filename}`;
  } else {
      // Nếu không, tạo avatar mặc định theo tên
      avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const pool = await sql.connect();

    // 1. Tạo User
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .input('password', sql.VarChar, hashedPassword)
      .input('name', sql.NVarChar, name)
      .input('avatar', sql.NVarChar, avatarUrl)
      .query('INSERT INTO Users (Email, Password, Name, Avatar) OUTPUT INSERTED.Id VALUES (@email, @password, @name, @avatar)');

    const newUserId = result.recordset[0].Id;

    // 2. Gán Role (Mặc định là User nếu không chọn)
    const userRole = role || 'User'; 
    
    // Lưu ý: Đảm bảo bảng Roles trong DB có các dòng Name: 'Admin', 'Seller', 'User' (viết hoa chữ cái đầu)
    await pool.request()
      .input('userId', sql.Int, newUserId)
      .input('roleName', sql.VarChar, userRole)
      .query("INSERT INTO UserRoles (UserId, RoleId) SELECT @userId, Id FROM Roles WHERE Name = @roleName");

    res.status(201).json({ message: 'Tạo tài khoản thành công', userId: newUserId });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await sql.connect();

    // 1. Tìm user theo Email
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT Id, Email, Password, Name, Avatar, Money FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const user = result.recordset[0];

    // 2. So sánh mật khẩu
    const isValidPassword = await bcrypt.compare(password, user.Password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // 3. Lấy Roles
    const rolesRes = await pool.request()
      .input('userId', sql.Int, user.Id)
      .query('SELECT r.Name FROM Roles r JOIN UserRoles ur ON ur.RoleId = r.Id WHERE ur.UserId = @userId');
    
    // Mảng roles ['User', 'Seller']
    const roles = rolesRes.recordset.map(r => r.Name);

    // 4. Tạo Token
    const token = jwt.sign({ id: user.Id, email: user.Email, roles }, JWT_SECRET, { expiresIn: '365d' });
    console.log(`🔑 Token generated for ${user.Email} with roles: ${JSON.stringify(roles)}`);

    // 5. Trả về Response
    res.json({ 
        message: 'Đăng nhập thành công', 
        token, 
        user: { 
            id: user.Id, 
            email: user.Email, 
            name: user.Name, 
            avatar: user.Avatar,
            balance: user.Money || 0,
            roles: roles // Quan trọng: Frontend sẽ dùng biến này để chuyển hướng
        } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Current User Info (Fix for immediate logout issue)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const pool = await sql.connect();
        
        // 1. Get User Info
        const userRes = await pool.request()
            .input('id', sql.Int, req.userId)
            .query('SELECT Id, Email, Name, Avatar, Money FROM Users WHERE Id = @id');
            
        if (userRes.recordset.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = userRes.recordset[0];
        
        // 2. Get Roles
        const rolesRes = await pool.request()
            .input('userId', sql.Int, user.Id)
            .query('SELECT r.Name FROM Roles r JOIN UserRoles ur ON ur.RoleId = r.Id WHERE ur.UserId = @userId');
            
        const roles = rolesRes.recordset.map(r => r.Name);
        
        res.json({ 
            id: user.Id, 
            email: user.Email, 
            name: user.Name, 
            avatar: user.Avatar, 
            balance: user.Money || 0,
            roles 
        });
    } catch (error) {
        console.error('/me error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- FORGOT PASSWORD ---

// 1. Yêu cầu đặt lại mật khẩu (Gửi email)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const pool = await sql.connect();
        const userRes = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT Id FROM Users WHERE Email = @email');

        if (userRes.recordset.length === 0) {
            // Bảo mật: Không thông báo rõ ràng email có tồn tại hay không
            return res.json({ message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' });
        }

        // Tạo token ngẫu nhiên
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // Hết hạn sau 1 giờ

        // Lưu token vào DB
        await pool.request()
            .input('token', sql.VarChar, token)
            .input('expiry', sql.DateTime2, expiry)
            .input('email', sql.VarChar, email)
            .query('UPDATE Users SET ResetToken = @token, ResetTokenExpiry = @expiry WHERE Email = @email');

        // Gửi email
        const resetLink = `${appSettings.PublicUrl || 'http://localhost:5200'}/?resetToken=${token}`;
        
        await transporter.sendMail({
            from: `"AuctionPro Support" <${appSettings.Gmail.Username}>`,
            to: email,
            subject: 'Đặt lại mật khẩu - AuctionPro',
            html: `
                <h3>Yêu cầu đặt lại mật khẩu</h3>
                <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản AuctionPro.</p>
                <p>Vui lòng click vào link dưới đây để đặt lại mật khẩu (Link hết hạn sau 1 giờ):</p>
                <a href="${resetLink}" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Đặt lại mật khẩu</a>
                <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
            `
        });

        res.json({ message: 'Đã gửi email hướng dẫn. Vui lòng kiểm tra hộp thư (cả mục Spam).' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Đặt lại mật khẩu mới
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const pool = await sql.connect();
        
        // Kiểm tra token và thời hạn
        const userRes = await pool.request()
            .input('token', sql.VarChar, token)
            .query('SELECT Id FROM Users WHERE ResetToken = @token AND ResetTokenExpiry > GETDATE()');

        if (userRes.recordset.length === 0) {
            return res.status(400).json({ message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.request()
            .input('password', sql.VarChar, hashedPassword)
            .input('token', sql.VarChar, token)
            .query('UPDATE Users SET Password = @password, ResetToken = NULL, ResetTokenExpiry = NULL WHERE ResetToken = @token');

        res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Tự động tạo tài khoản Admin nếu chưa có ---
const createDefaultAdmin = async () => {
    try {
        // Đợi 2s để đảm bảo DB đã kết nối
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Kiểm tra nếu chưa kết nối DB thì bỏ qua để tránh lỗi crash
        if (!sql.globalPool || !sql.globalPool.connected) {
            return;
        }

        const pool = await sql.connect();
        const email = 'admin@gmail.com';
        
        // Kiểm tra xem admin đã tồn tại chưa
        const userCheck = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT Id FROM Users WHERE Email = @email');
            
        if (userCheck.recordset.length === 0) {
            console.log('Creating default admin account...');
            const hashedPassword = await bcrypt.hash('aimabiet123', 10);
            
            // Tạo User
            const result = await pool.request()
                .input('email', sql.VarChar, email)
                .input('password', sql.VarChar, hashedPassword)
                .input('name', sql.VarChar, 'Administrator')
                .query('INSERT INTO Users (Email, Password, Name) OUTPUT INSERTED.Id VALUES (@email, @password, @name)');
            
            const adminId = result.recordset[0].Id;
            
            // Gán quyền Admin (Lấy RoleId từ bảng Roles)
            await pool.request()
                .input('userId', sql.Int, adminId)
                .query("INSERT INTO UserRoles (UserId, RoleId) SELECT @userId, Id FROM Roles WHERE Name = 'Admin'");
                
            console.log('✅ Admin account created: admin@gmail.com / aimabiet123');
        }
    } catch (error) {
        console.error('Auto-create admin error:', error.message);
    }
};
createDefaultAdmin();

module.exports = router;