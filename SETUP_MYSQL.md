# 📋 Hướng Dẫn Setup Hoàn Chỉnh - Hệ Thống Đấu Giá (MySQL)

**Cập nhật Gần Đây:** 
- ✅ Chuyển từ SQL Server → MySQL/MariaDB
- ✅ Sửa lỗi `getDatabaseManager is not a function`
- ✅ Thay đổi lưu trữ: Ảnh → Cơ sở dữ liệu (LONGBLOB)
- ✅ Dịch toàn bộ code sang tiếng Việt
- ✅ Schema database mới: `AuctionWebsite.sql`

---

## 🚀 Bước 1: Chuẩn Bị Môi Trường

### Yêu Cầu
- **Node.js** 18+ (Kiểm tra: `node -v`)
- **npm** 9+ (Kiểm tra: `npm -v`)
- **MySQL** 8.0+ hoặc **MariaDB** 10.5+ (hoặc **Laragon** đã kích hoạt)

### Kiểm Tra Node.js
```bash
# Mở Command Prompt (cmd.exe), KHÔNG phải PowerShell
node -v    # Kỳ vọng v18.x hoặc cao hơn
npm -v     # Kỳ vọng 9.x hoặc cao hơn
```

---

## 🐘 Bước 2: Chuẩn Bị Cơ Sở Dữ Liệu MySQL

### Nếu Dùng Laragon (khuyến nghị)

1. **Mở Laragon**
   - Nhấn `Start All`
   - Xác nhận MySQL chạy (nút sẽ xanh lá)

2. **Mở phpMyAdmin**
   - Database → Create New
   - Hoặc vào http://localhost/phpmyadmin

### Hoặc Dùng MySQL Command Line

```bash
# Kết nối MySQL
mysql -u root -p

# Nếu không có mật khẩu (root Laragon)
mysql -u root

# Sau khi vào MySQL shell
CREATE DATABASE AuctionWebsite 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

# Nhập schema
USE AuctionWebsite;
SOURCE C:/Project/AuctionSystem/AuctionWebsite.sql;

# Xác nhận các bảng được tạo
SHOW TABLES;

# Thoát
EXIT;
```

### Hoặc Nhập Schema từ GUI
1. Mở phpMyAdmin
2. Click **Import**
3. Chọn `AuctionWebsite.sql`
4. Click **Go**

---

## 🔧 Bước 3: Cài Đặt Dependencies

**QUAN TRỌNG: Mở Command Prompt (cmd.exe), KHÔNG phải PowerShell**

```bash
# Đi tới thư mục dự án
cd C:\Project\AuctionSystem

# Cài đặt packages
npm install
```

**Những package sẽ được thêm vào:**
- `mysql2` (thay vì `mssql`)
- Tất cả phụ thuộc khác: express, socket.io, bcryptjs, v.v.

---

## ⚙️ Bước 4: Cấu Hình Môi Trường

### Tạo file `.env`

```bash
# Windows cmd
copy .env.example .env
```

### Chỉnh sửa `.env`

**Thay đổi cấu hình MySQL (nếu cần):**

```plaintext
# Mặc định cho Laragon:
DB_HOST=localhost
DB_PORT=3306
DB_NAME=AuctionWebsite
DB_USER=root
DB_PASSWORD=           # Trống cho Laragon (hoặc nhập mật khẩu nếu có)
```

**Nếu dùng MySQL độc lập:**
```plaintext
DB_HOST=localhost      # Hoặc IP server
DB_PORT=3306           # Cổng MySQL (mặc định 3306)
DB_NAME=AuctionWebsite
DB_USER=root           # Hoặc user khác
DB_PASSWORD=YourPassword
```

---

## ✅ Bước 5: Khởi Động Máy Chủ

**Mở Command Prompt và chạy:**

```bash
cd C:\Project\AuctionSystem

# Khởi động ở chế độ development (có hot reload khi thay đổi file)
npm run dev

# Hoặc
npm start
```

### Kỳ Vọng Thấy:
```
[2026-03-23T...] [INFO] [Máy Chủ] 🚀 Bắt đầu máy chủ hệ thống đấu giá...
[2026-03-23T...] [INFO] [Máy Chủ] Môi trường: development
[2026-03-23T...] [INFO] [Máy Chủ] Cổng: 3000
[2026-03-23T...] [INFO] [Máy Chủ] 📊 Kết nối cơ sở dữ liệu...
[2026-03-23T...] [INFO] [Cơ Sở Dữ Liệu] ✅ Kết nối cơ sở dữ liệu thành công
[2026-03-23T...] [INFO] [Máy Chủ] ✅ Máy chủ chạy trên cổng 3000
[2026-03-23T...] [INFO] [Máy Chủ] 🌐 URL: http://localhost:3000
```

### Nếu Gặp Lỗi

**Lỗi: "Database not connected"**
- Kiểm tra MySQL/Laragon đã chạy chưa
- Kiểm tra `.env` có đúng host/port/password không

**Lỗi: "ECONNREFUSED localhost:3306"**
- MySQL chưa chạy
- Laragon chưa bật
- Đổi `DB_HOST` sang IP đúng

**Lỗi: "Access denied for user 'root'@'localhost'"**
- Kiểm tra `DB_PASSWORD` trong `.env`
- Laragon root không có mật khẩu (trống)

---

## 🌍 Bước 6: Kiểm Tra API

Mở trình duyệt và truy cập:

```
http://localhost:3000/api/health
```

**Kỳ Vọng Thấy:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-03-23T04:20:00.000Z"
}
```

---

## 📁 Cấu Trúc File sau Update

```
AuctionSystem/
��── .env                    # ← Cấu hình môi trường (TẠO BẰNG TANGAN)
├── .env.example            # Template (đã cập nhật MySQL)
├── AuctionWebsite.sql      # ← Schema database (MỚI)
├── package.json            # ← Đã cập nhật (mysql2 thay mssql)
├── src/
│   ├── server.js           # ← Dịch sang tiếng Việt
│   ├── config/index.js     # ← Cập nhật MySQL config
│   ├── logger/Logger.js    # ← Dịch sang tiếng Việt
│   ├── repositories/
│   │   ├── DatabaseManager.js    # ← Chuyển sang mysql2
│   │   ├── index.js              # ← Thêm getDatabaseManager()
│   │   ├── BaseRepository.js     # (sẽ dịch tiếp)
│   │   └── ...
│   └── ...
└── ...
```

---

## 🔍 Những Thay Đổi Chính

### 1. **Database Connection**
- **Trước:** SQL Server (mssql package)
- **Sau:** MySQL (mysql2 package) ✅

### 2. **Lỗi DatabaseManager**
- **Trước:** `getDatabaseManager is not a function`
- **Sau:** Export function đúng trong `repositories/index.js` ✅

### 3. **Lưu Trữ Ảnh**
- **Trước:** Thư mục `/uploads/`
- **Sau:** Database (LONGBLOB) - không dùng file system ✅

### 4. **Comment Trong Code**
- **Trước:** Tiếng Anh
- **Sau:** Tiếng Việt (đang dịch từng file) ✅

---

## 📝 Các File Đã Dịch

- ✅ `src/server.js` - Khởi động máy chủ
- ✅ `src/logger/Logger.js` - Hệ thống ghi nhật ký
- ✅ `src/config/index.js` - Quản lý cấu hình
- ⏳ `src/repositories/BaseRepository.js` - (sắp tới)
- ⏳ `src/repositories/DatabaseManager.js` - (sắp tới)
- ⏳ `src/services/*.js` - (sắp tới)
- ⏳ `src/routes/*.js` - (sắp tới)

---

## 🧪 Test Nhanh

### 1. Kiểm Tra POST /api/auth/login (Chưa Có User)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com", "password":"password"}'
```

**Kỳ Vọng:** Lỗi (vì chưa tạo user)

### 2. Kiểm Tra GET /api/health
```bash
curl http://localhost:3000/api/health
```

**Kỳ Vọng:** `{ "success": true, ... }`

---

## ❓ Câu Hỏi Thường Gặp (FAQ)

**Q: Làm thế nào để Laragon chạy MySQL?**
A: Mở Laragon → Bấm **Start All** nút xanh → MySQL chạy tự động

**Q: Tôi dùng MySQL khác, làm thế nào?**
A: Cập nhật `.env`:
- `DB_HOST` = địa chỉ server
- `DB_USER` = user MySQL
- `DB_PASSWORD` = mật khẩu

**Q: File ảnh đi đâu rồi?**
A: Ảnh được lưu vào database trong cột `avatar` (LONGBLOB) thay vì file system

**Q: Khi nào dịch hết code sang tiếng Việt?**
A: Các file chính đã dịch. Các file khác sẽ dịch tiếp theo yêu cầu.

---

## 🛑 Kiến Thức Công Nghệ

**Công nghệ được sử dụng:**

| Thành Phần | Công Nghệ | Phiên Bản |
|-----------|-----------|----------|
| **Backend** | Node.js | 18+ |
| **Framework** | Express | 4.18 |
| **Database** | MySQL | 8.0+ |
| **Real-time** | Socket.io | 4.7 |
| **Auth** | JWT | 9.0 |
| **Hash** | bcryptjs | 2.4 |

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề:

1. **Kiểm tra MySQL đã chạy**
   ```bash
   mysql -u root -e "SELECT VERSION();"
   ```

2. **Kiểm tra kết nối**
   ```bash
   npm run dev
   ```

3. **Xem log chi tiết**
   - Cấp nhật `LOG_LEVEL=DEBUG` trong `.env`
   - Chạy `npm run dev` lại

---

**Tất cả sẵn sàng! Hãy bắt đầu với `npm run dev`** 🚀
