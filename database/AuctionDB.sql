-- Xóa bảng cũ theo thứ tự để tránh lỗi ràng buộc (nếu muốn reset)
DROP TABLE Payments;
DROP TABLE Bids;
DROP TABLE Auctions;
DROP TABLE Products;
DROP TABLE ProductImages;
DROP TABLE UserRoles;
DROP TABLE Roles;
DROP TABLE Users;
GO

-- 1. Bảng Users
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(256) UNIQUE NOT NULL,
    Password NVARCHAR(256),
    Name NVARCHAR(256),
    Avatar NVARCHAR(MAX),
    GoogleId NVARCHAR(256),
    FacebookId NVARCHAR(256),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- 2. Bảng Roles
CREATE TABLE Roles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) UNIQUE NOT NULL
);

-- 3. Bảng UserRoles
CREATE TABLE UserRoles (
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE
);

-- 4. Bảng Products (Phải tạo trước Auctions vì Auctions tham chiếu tới nó)
CREATE TABLE Products (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SellerId INT NULL, -- Thêm để quản lý sản phẩm theo người bán
    Name NVARCHAR(256) NOT NULL,
    Description NVARCHAR(MAX),
    Price DECIMAL(18,2) NOT NULL,
    Stock INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (SellerId) REFERENCES Users(Id)
);

-- 4.1 Bảng ProductImages (Lưu nhiều ảnh cho sản phẩm)
CREATE TABLE ProductImages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProductId INT NOT NULL,
    ImageUrl NVARCHAR(MAX) NOT NULL,
    FOREIGN KEY (ProductId) REFERENCES Products(Id) ON DELETE CASCADE
);

-- 5. Bảng Auctions
CREATE TABLE Auctions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ProductId INT NOT NULL,
    Title NVARCHAR(256),
    StartingBid DECIMAL(18,2) NOT NULL,
    CurrentBid DECIMAL(18,2),
    HighestBidderId INT NULL,
    EndTime DATETIME2 NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Active',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ProductId) REFERENCES Products(Id) ON DELETE NO ACTION,
    FOREIGN KEY (HighestBidderId) REFERENCES Users(Id)
);

-- 6. Bảng Bids
CREATE TABLE Bids (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AuctionId INT NOT NULL,
    UserId INT NOT NULL,
    BidAmount DECIMAL(18,2) NOT NULL,
    BidTime DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (AuctionId) REFERENCES Auctions(Id) ON DELETE CASCADE,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- 7. Bảng Payments
CREATE TABLE Payments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    AuctionId INT NOT NULL,
    UserId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Pending',
    MomoOrderId NVARCHAR(256),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (AuctionId) REFERENCES Auctions(Id),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- --- CHÈN DỮ LIỆU MẪU ---
INSERT INTO Roles (Name) VALUES ('User'), ('Seller'), ('Admin');

-- Tạo User mẫu (Mật khẩu là hash của '123456' ví dụ)
INSERT INTO Users (Email, Password, Name, Avatar) VALUES ('seller@gmail.com', '$2a$10$YourHashedPasswordHere', 'Nguyen Van Ban', 'https://ui-avatars.com/api/?name=Nguyen+Van+Ban&background=random');
INSERT INTO Users (Email, Password, Name, Avatar) VALUES ('buyer@gmail.com', '$2a$10$YourHashedPasswordHere', 'Tran Van Mua', 'https://ui-avatars.com/api/?name=Tran+Van+Mua&background=random');

-- Gán quyền (1: User, 2: Seller, 3: Admin)
INSERT INTO UserRoles (UserId, RoleId) VALUES (1, 2); -- Seller
INSERT INTO UserRoles (UserId, RoleId) VALUES (2, 1); -- User

-- Sản phẩm mẫu (Giá VND)
INSERT INTO Products (Name, Description, Price, Stock, SellerId) 
VALUES (N'iPhone 15 Pro Max', N'Điện thoại mới 99%, màu Titan tự nhiên', 25000000.00, 1, 1);

-- Ảnh mẫu cho sản phẩm
INSERT INTO ProductImages (ProductId, ImageUrl) VALUES 
(1, 'https://cdn.tgdd.vn/Products/Images/42/305658/iphone-15-pro-max-blue-thumbnew-600x600.jpg'),
(1, 'https://cdn.tgdd.vn/Products/Images/42/305658/iphone-15-pro-max-titan-tu-nhien-1-1.jpg');

-- Đấu giá mẫu
INSERT INTO Auctions (ProductId, Title, StartingBid, CurrentBid, EndTime) 
VALUES (1, N'Đấu giá iPhone 15 Pro Max', 25000000.00, 25000000.00, DATEADD(day, 3, GETDATE()));

-- Thêm một đấu giá ĐÃ KẾT THÚC (User 2 thắng) để test chức năng "Won Auctions"
INSERT INTO Products (Name, Description, Price, Stock, SellerId) VALUES (N'MacBook Pro M3', N'Laptop Apple mới', 40000000.00, 1, 1);
INSERT INTO ProductImages (ProductId, ImageUrl) VALUES (2, 'https://cdn.tgdd.vn/Products/Images/44/318225/macbook-pro-14-inch-m3-pro-18gb-512gb-thumb-600x600.jpg');
INSERT INTO Auctions (ProductId, Title, StartingBid, CurrentBid, HighestBidderId, EndTime, Status) 
VALUES (2, N'Đấu giá MacBook Pro M3', 40000000.00, 45000000.00, 2, DATEADD(day, -1, GETDATE()), 'Ended');
GO