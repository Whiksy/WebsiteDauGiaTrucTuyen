# Setup Guide - Getting Started with Refactored Auction System

## Prerequisites

- **Node.js** 14+ (check: `node --version`)
- **SQL Server** (local or remote)
- **npm** (check: `npm --version`)
- **Git** (for version control)

## Quick Start

### 1. Clone/Download Project

```bash
cd c:\Project\AuctionSystem
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Database
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=AuctionDB
DB_USER=AuctionUser
DB_PASSWORD=your_password_here

# JWT Secret (change this!)
JWT_SECRET=your-super-secret-key-change-in-production

# Server
NODE_ENV=development
PORT=3000
PUBLIC_URL=http://localhost:3000
```

### 4. Setup Database

Make sure SQL Server is running and `AuctionDB` exists with tables.

If not, run the migration script:

```bash
npm run migrate
```

Or manually create database from `database/AuctionDB.sql`:

```bash
# In SQL Server Management Studio or Azure Data Studio
# Open and run: database/AuctionDB.sql
```

### 5. Start Development Server

```bash
npm run dev
```

Expected output:

```
[Timestamp] [INFO] [Server] 🚀 Starting Auction System Server...
[Timestamp] [INFO] [Server] Environment: development
[Timestamp] [INFO] [Database] 📊 Connecting to database...
[Timestamp] [INFO] [Database] ✅ Database connected successfully
[Timestamp] [INFO] [Express] 🔧 Creating Express app...
[Timestamp] [INFO] [WebSocket] 🔌 Initializing WebSocket...
[Timestamp] [INFO] [WebSocket] ✅ WebSocket initialized successfully
[Timestamp] [INFO] [SchedulerService] 🚀 Starting scheduler service
[Timestamp] [INFO] [Server] ✅ Server running on port 3000
```

### 6. Test Server Health

Open browser or terminal:

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-03-23T10:30:00.000Z",
  "environment": "development"
}
```

## API Testing

### Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response includes token:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "Test User",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Get Auctions

```bash
curl http://localhost:3000/api/auctions
```

### Place Bid (requires token)

```bash
curl -X POST http://localhost:3000/api/auctions/1/bid \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{ "amount": 150000 }'
```

## Project Structure Reference

```
AuctionSystem/
├── src/                   # Source code
│   ├── config/           # Configuration management
│   ├── constants/        # Enums and constants
│   ├── errors/           # Custom error classes
│   ├── logger/           # Logging service
│   ├── utils/            # Utilities (formatters, validators)
│   ├── middleware/       # Express middleware
│   ├── repositories/     # Data access layer
│   ├── services/         # Business logic
│   ├── routes/           # API routes
│   ├── websocket/        # WebSocket handlers
│   ├── app.js            # Express setup
│   └── server.js         # Entry point
│
├── public/               # Static files (HTML)
├── database/             # Database schema & migrations
├── uploads/              # User uploads (avatars, images)
├── .env.example          # Environment template
├── package.json          # Dependencies
├── ARCHITECTURE.md       # Architecture documentation
├── MIGRATION_GUIDE.md    # Migration instructions
└── SETUP.md             # This file
```

## Common Tasks

### Debug Mode

Check logs with DEBUG level:

```bash
LOG_LEVEL=DEBUG npm run dev
```

### Code Formatting

```bash
npm run lint  # Fix code style
```

### Run Tests

```bash
npm test
```

### Production Build

```bash
NODE_ENV=production npm start
```

## Environment Variables Reference

### Server
- `NODE_ENV` - development, staging, production
- `PORT` - Server port (default: 3000)
- `PUBLIC_URL` - Public server URL
- `LOG_LEVEL` - DEBUG, INFO, WARN, ERROR

### Database
- `DB_SERVER` - SQL Server hostname
- `DB_PORT` - SQL Server port (default: 1433)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_ENCRYPT` - Enable encryption (true/false)
- `DB_TRUST_CERTIFICATE` - Trust cert (true/false)

### JWT  
- `JWT_SECRET` - Secret for JWT signing (CHANGE IN PRODUCTION!)
- `JWT_EXPIRES_IN` - Token expiry (e.g., "24h")

### Redis Cache (optional)
- `REDIS_HOST` - Redis server
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_PASSWORD` - Redis password (if needed)
- `REDIS_DB` - Redis database number

### Email
- `EMAIL_SMTP_HOST` - SMTP server (default: smtp.gmail.com)
- `EMAIL_SMTP_PORT` - SMTP port (default: 587)
- `EMAIL_USERNAME` - Email account
- `EMAIL_PASSWORD` - Email password
- `EMAIL_FROM` - From address

### Payment Gateway (Momo)
- `MOMO_PARTNER_CODE` - Momo partner code
- `MOMO_ACCESS_KEY` - Momo access key
- `MOMO_SECRET_KEY` - Momo secret key
- `MOMO_ENDPOINT` - Momo API endpoint

### OAuth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `FACEBOOK_APP_ID` - Facebook app ID
- `FACEBOOK_APP_SECRET` - Facebook app secret

### File Upload
- `MAX_FILE_SIZE` - Max upload size in bytes (default: 5242880 = 5MB)
- `ALLOWED_EXTENSIONS` - Allowed file types (comma-separated)
- `UPLOAD_DIR` - Upload directory path

## Troubleshooting

### Port Already in Use

```bash
# Change port
PORT=3001 npm run dev

# Or kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error

1. Check SQL Server is running
2. Check `.env` credentials
3. Check database exists:

```sql
SELECT * FROM sys.databases WHERE name = 'AuctionDB';
```

4. Check tables exist:

```sql
USE AuctionDB;
SELECT * FROM INFORMATION_SCHEMA.TABLES;
```

### JWT Token Expired

Generate new token by logging in again.

### CORS Errors

Check `PUBLIC_URL` in `.env` matches your client URL.

### WebSocket Not Connecting

- Check browser console for errors
- Check SERVER logs
- Verify Socket.io client library is loaded in HTML

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand design
2. Review existing services for examples
3. Check [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) if migrating old code
4. Start building features!

## Support

- Check documentation files (ARCHITECTURE.md, MIGRATION_GUIDE.md)
- Review existing code as examples
- Check error messages carefully
- Enable DEBUG logging for details

## Production Deployment

Before deploying to production:

1. ✅ Change `JWT_SECRET` to strong value
2. ✅ Change `SESSION_SECRET` to strong value
3. ✅ Set `NODE_ENV=production`
4. ✅ Set `SESSION_COOKIE_SECURE=true`
5. ✅ Update all external service credentials
6. ✅ Review all error logs
7. ✅ Test all payment flows
8. ✅ Setup monitoring/alerts
9. ✅ Setup backup strategy
10. ✅ Test disaster recovery

Good luck! 🚀
