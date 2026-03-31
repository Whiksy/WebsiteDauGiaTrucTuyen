# 🎯 Real-time Auction System

**Professional Node.js Auction System** with real-time bidding, clean architecture, and enterprise-grade design patterns.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-blue)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-brightgreen)](https://socket.io/)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2019+-red)](https://www.microsoft.com/sql-server)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## ✨ Features

🔴 **Real-time Bidding** - Live auction updates via Socket.io WebSocket
🔐 **Secure Authentication** - JWT tokens + OAuth (Google/Facebook)
💰 **Payment Integration** - Momo gateway for transactions
⚡ **Caching Layer** - Redis for performance optimization
🗄️ **SQL Server Database** - Persistent data storage
🧼 **Clean Architecture** - Service/Repository pattern
🔍 **Structured Logging** - Professional error tracking
✅ **Error Handling** - Custom error classes with HTTP mapping

## 📁 Project Structure

```
src/                    # Clean, organized source code
├── config/            # Environment configuration
├── constants/         # Enums and validation rules
├── errors/            # Custom error classes
├── logger/            # Structured logging
├── middleware/        # Express middleware (auth, errors)
├── repositories/      # Data access layer
├── services/          # Business logic layer
├── routes/            # API endpoints
├── utils/             # Helper functions
└── websocket/         # Real-time handlers

public/                # Frontend HTML files
uploads/               # User files (avatars, images)
.env                   # Configuration (local)
.env.example          # Configuration template
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- SQL Server 2019+
- npm or yarn

### Installation

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd AuctionSystem
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and credentials
   ```

3. **Setup Database**
   - Create `AuctionDB` database in SQL Server
   - Schema will be created on first run via DatabaseManager
   - Or manually import SQL schema if needed

4. **Start Server**
   ```bash
   npm run dev      # Development (with hot reload)
   npm start        # Production
   ```

5. **Access Application**
   ```
   API:     http://localhost:3000/api
   Health:  http://localhost:3000/api/health
   WebSocket: ws://localhost:3000
   ```

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Design patterns & architecture
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Upgrade from old code
- **[REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)** - Complete refactoring details
- **[CLEANUP_REPORT.md](CLEANUP_REPORT.md)** - Project cleanup summary

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register            # Register new user
POST   /api/auth/login               # Login & get token
GET    /api/auth/me                  # Get current user
PUT    /api/auth/profile             # Update profile
POST   /api/auth/change-password     # Change password
```

### Auctions
```
GET    /api/auctions                 # List active auctions
GET    /api/auctions/search          # Search auctions
GET    /api/auctions/:id             # Get auction details
POST   /api/auctions/:id/bid         # Place a bid
GET    /api/auctions/:id/bids        # Get bid history
```

### Products
```
POST   /api/products                 # Create product
GET    /api/products/:id             # Get product
PUT    /api/products/:id             # Update product
```

### Payments
```
GET    /api/payments/history         # Payment history
POST   /api/payments/create          # Create payment
POST   /api/payments/complete        # Payment webhook
```

## 🏗️ Architecture

**Layered Architecture Pattern:**

```
API Routes (Thin Controllers)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
    ↓
Database (SQL Server)
```

**Key Components:**
- **Error Handling** - 7 custom error classes
- **Logging** - Multi-level structured logger
- **Middleware** - Authentication, error handling, logging
- **Database** - Connection pooling & transactions
- **WebSocket** - Real-time bid updates
- **Scheduler** - Cron jobs for auction processing

## 🔧 Configuration

All settings in `.env` file:

```env
# Database
DATABASE_SERVER=localhost
DATABASE_NAME=AuctionDB
DATABASE_USER=sa
DATABASE_PASSWORD=YourPassword

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d

# Server
PORT=3000
NODE_ENV=development

# Services
SMTP_USER=your_email@gmail.com
MOMO_API_KEY=your_momo_key
```

See `.env.example` for all available options.

## 🧪 Testing

The clean architecture makes testing easy:

```javascript
// Mock repository, test service
const mockRepo = {};
const service = new AuctionService(mockRepo);
const result = await service.createAuction(...);
```

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check connection parameters in .env
# Verify SQL Server is running
# Check SQL Server port (default 1433)
```

### Port Already In Use
```bash
# Server auto-retries on next port
# Or change PORT in .env
```

### JWT Token Expired
```bash
# Token lifetime set in JWT_EXPIRE
# Re-login to get new token
```

## 📝 License

MIT License - See [LICENSE](LICENSE) for details

## 👨‍💻 Development

### Code Quality
- ✅ Clean Code principles
- ✅ SOLID design patterns
- ✅ Professional error handling
- ✅ Comprehensive logging

### Best Practices
- Service layer for business logic
- Repository pattern for data access
- Dependency injection
- Centralized configuration
- Environment-based secrets

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Create Pull Request

---

**Last Updated:** March 23, 2026
**System Status:** ✅ Production Ready


## API Endpoints

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/facebook` - Facebook OAuth
- `GET /api/auction/:id` - Get auction details
- `POST /api/auction/:id/bid` - Place a bid
- `POST /api/payment/create` - Create Momo payment

## Socket Events

- `joinAuction` - Join auction room
- `placeBid` - Place a bid (handled server-side)
- `bidUpdate` - Receive bid updates