const sql = require('mssql');
const config = require('../config/appsettings');

(async () => {
  try {
    const pool = await sql.connect(config.ConnectionStrings.DefaultConnection);

    // Check if Roles table exists
    const rolesExist = await pool.request().query("SELECT OBJECT_ID('Roles') AS Id");
    if (rolesExist.recordset[0].Id) {
      console.log('Roles table already exists.');
    } else {
      console.log('Creating Roles table...');
      await pool.request().query(`
        CREATE TABLE Roles (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          Name NVARCHAR(100) UNIQUE NOT NULL
        );
      `);
      console.log('Inserting roles...');
      await pool.request().query(`
        INSERT INTO Roles (Name) VALUES ('User'), ('Seller'), ('Admin');
      `);
    }

    // Check if UserRoles table exists
    const userRolesExist = await pool.request().query("SELECT OBJECT_ID('UserRoles') AS Id");
    if (userRolesExist.recordset[0].Id) {
      console.log('UserRoles table already exists.');
    } else {
      console.log('Creating UserRoles table...');
      await pool.request().query(`
        CREATE TABLE UserRoles (
          UserId INT NOT NULL,
          RoleId INT NOT NULL,
          PRIMARY KEY (UserId, RoleId),
          FOREIGN KEY (UserId) REFERENCES Users(Id),
          FOREIGN KEY (RoleId) REFERENCES Roles(Id)
        );
      `);
    }

    // Assign role 'User' to existing users if not already assigned
    const users = await pool.request().query('SELECT Id FROM Users');
    for (const user of users.recordset) {
      const existing = await pool.request().input('userId', sql.Int, user.Id).query('SELECT COUNT(*) AS cnt FROM UserRoles WHERE UserId = @userId');
      if (existing.recordset[0].cnt === 0) {
        const roleId = await pool.request().query("SELECT Id FROM Roles WHERE Name = 'User'");
        if (roleId.recordset.length > 0) {
          await pool.request().input('userId', sql.Int, user.Id).input('roleId', sql.Int, roleId.recordset[0].Id).query('INSERT INTO UserRoles (UserId, RoleId) VALUES (@userId, @roleId)');
          console.log(`Assigned role 'User' to user ${user.Id}`);
        }
      }
    }

    // Check & Fix Users table (Avatar column)
    const avatarCheck = await pool.request().query("SELECT COL_LENGTH('Users', 'Avatar') AS Len");
    if (avatarCheck.recordset[0].Len === null) {
        console.log('🛠 Adding missing column: Avatar to Users table...');
        await pool.request().query("ALTER TABLE Users ADD Avatar NVARCHAR(MAX)");
    }

    // Check & Fix Users table (ResetToken columns for Forgot Password)
    const resetTokenCheck = await pool.request().query("SELECT COL_LENGTH('Users', 'ResetToken') AS Len");
    if (resetTokenCheck.recordset[0].Len === null) {
        console.log('🛠 Adding missing columns: ResetToken to Users table...');
        await pool.request().query("ALTER TABLE Users ADD ResetToken VARCHAR(256), ResetTokenExpiry DATETIME2");
    }

    // Check & Fix Users table (Money/Balance column)
    const moneyCheck = await pool.request().query("SELECT COL_LENGTH('Users', 'Money') AS Len");
    if (moneyCheck.recordset[0].Len !== null) {
        console.log('✅ Column Users.Money already exists.');
    } else {
        console.log('Column Users.Money does not exist. Checking for Users.Balance...');
        // Check for Balance column
        const balanceCheck = await pool.request().query("SELECT COL_LENGTH('Users', 'Balance') AS Len");
        if (balanceCheck.recordset[0].Len !== null) {
            console.log('🛠 Found Users.Balance column. Renaming to Money...');
            await pool.request().query("EXEC sp_rename 'Users.Balance', 'Money', 'COLUMN';");
            console.log('✅ Renamed Users.Balance to Users.Money.');
        } else {
            console.log('🛠 Neither Money nor Balance found. Adding Money column to Users table...');
            await pool.request().query("ALTER TABLE Users ADD Money DECIMAL(18, 2) DEFAULT 0;");
            console.log('✅ Added Money column to Users table.');
        }
    }

    // Check Products table
    const productsExist = await pool.request().query("SELECT OBJECT_ID('Products') AS Id");
    if (productsExist.recordset[0].Id) {
      console.log('Products table already exists.');
      // Kiểm tra và thêm cột SellerId nếu thiếu (quan trọng cho chức năng Seller)
      const sellerIdCheck = await pool.request().query("SELECT COL_LENGTH('Products', 'SellerId') AS Len");
      if (sellerIdCheck.recordset[0].Len === null) {
          console.log('🛠 Adding missing column: SellerId to Products table...');
          await pool.request().query("ALTER TABLE Products ADD SellerId INT REFERENCES Users(Id)");
      }
    } else {
      console.log('Creating Products table...');
      await pool.request().query(`
        CREATE TABLE Products (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          SellerId INT NULL,
          Name NVARCHAR(256) NOT NULL,
          Description NVARCHAR(MAX),
          Price DECIMAL(18,2) NOT NULL,
          Stock INT DEFAULT 0,
          CreatedAt DATETIME2 DEFAULT GETDATE(),
          UpdatedAt DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (SellerId) REFERENCES Users(Id)
        );
      `);
      console.log('Inserting sample product...');
      await pool.request().query(`
        INSERT INTO Products (Name, Description, Price, Stock) VALUES ('Sample Product', 'Product description', 250000.00, 10);
      `);
    }

    // Check ProductImages table (Fix lỗi Invalid object name 'ProductImages')
    const productImagesExist = await pool.request().query("SELECT OBJECT_ID('ProductImages') AS Id");
    if (!productImagesExist.recordset[0].Id) {
        console.log('Creating ProductImages table...');
        await pool.request().query(`
            CREATE TABLE ProductImages (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                ProductId INT NOT NULL,
                ImageUrl NVARCHAR(MAX) NOT NULL,
                FOREIGN KEY (ProductId) REFERENCES Products(Id) ON DELETE CASCADE
            );
        `);
    }

    // Check Auctions table
    const auctionsExist = await pool.request().query("SELECT OBJECT_ID('Auctions') AS Id");
    if (!auctionsExist.recordset[0].Id) {
        console.log('Creating Auctions table...');
        await pool.request().query(`
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
        `);
    }

    // Check Bids table
    const bidsExist = await pool.request().query("SELECT OBJECT_ID('Bids') AS Id");
    if (!bidsExist.recordset[0].Id) {
        console.log('Creating Bids table...');
        await pool.request().query(`
            CREATE TABLE Bids (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                AuctionId INT NOT NULL,
                UserId INT NOT NULL,
                BidAmount DECIMAL(18,2) NOT NULL,
                BidTime DATETIME2 DEFAULT GETDATE(),
                FOREIGN KEY (AuctionId) REFERENCES Auctions(Id) ON DELETE CASCADE,
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            );
        `);
    }

    // Check Payments table
    const paymentsExist = await pool.request().query("SELECT OBJECT_ID('Payments') AS Id");
    if (!paymentsExist.recordset[0].Id) {
        console.log('Creating Payments table...');
        await pool.request().query(`
            CREATE TABLE Payments (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                AuctionId INT NULL,
                UserId INT NOT NULL,
                Amount DECIMAL(18,2) NOT NULL,
                Status NVARCHAR(50) DEFAULT 'Pending',
                Type NVARCHAR(50) DEFAULT 'Auction',
                MomoOrderId NVARCHAR(256),
                CreatedAt DATETIME2 DEFAULT GETDATE(),
                FOREIGN KEY (AuctionId) REFERENCES Auctions(Id),
                FOREIGN KEY (UserId) REFERENCES Users(Id)
            );
        `);
    } else {
        // Migration: Add Type column if missing
        const typeCheck = await pool.request().query("SELECT COL_LENGTH('Payments', 'Type') AS Len");
        if (typeCheck.recordset[0].Len === null) {
            console.log('🛠 Adding missing column: Type to Payments table...');
            await pool.request().query("ALTER TABLE Payments ADD Type NVARCHAR(50) DEFAULT 'Auction'");
        }

        // Migration: Make AuctionId nullable
        const auctionIdCheck = await pool.request().query(`
            SELECT IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Payments' AND COLUMN_NAME = 'AuctionId'
        `);
        
        if (auctionIdCheck.recordset.length > 0 && auctionIdCheck.recordset[0].IS_NULLABLE === 'NO') {
             console.log('🛠 Altering Payments.AuctionId to be NULLABLE...');
             await pool.request().query("ALTER TABLE Payments ALTER COLUMN AuctionId INT NULL");
        }
    }

    console.log('Migration completed.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();