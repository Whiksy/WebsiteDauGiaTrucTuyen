# Auction System - Refactored Architecture

## Overview

This document explains the refactored Auction System architecture. The system has been completely redesigned following **SOLID principles, Clean Architecture, and OOP best practices**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                        │
│                                                                   │
│  - REST API Calls (Fetch/Axios)                                 │
│  - Real-time Updates (WebSocket/Socket.io)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER (src/app.js)                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MIDDLEWARE LAYER                      │   │
│  │  - Authentication (JWT verification)                    │   │
│  │  - Request Logging                                      │   │
│  │  - Error Handling (Global error catcher)                │   │
│  │  - CORS & Session Management                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────┬───────────┴──────────┬──────────────┐        │
│  │              │                      │              │        │
│  ▼              ▼                      ▼              ▼        │
│ Routes      Routes               Routes          Routes       │
│ /api/auth   /api/auctions        /api/products   /api/payments│
│             /api/bids                                         │
│                                                               │
│  (Thin Controllers - Organize I/O only)                      │
└─────────────────────────────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  SERVICE LAYER   │  │ WEBSOCKET       │  │  SCHEDULER       │
│  (Business Logic)│  │  HANDLERS       │  │  (Cron Jobs)     │
│                  │  │                 │  │                  │
│ - AuthService    │  │ - BidPlaced     │  │ - Process Ended  │
│ - AuctionService │  │ - AuctionJoin   │  │   Auctions       │
│ - ProductService │  │ - UserJoin      │  │ - Cleanup Sessions
│ - BiddingService │  │ - Connected     │  │ - SendReminders  │
│ - PaymentService │  └─────────────────┘  └──────────────────┘
│ - CacheService   │
└──────────────────┘
         │
         │ (Uses)
         ▼
┌──────────────────────────────────────────────┐
│       REPOSITORY LAYER (Data Access)         │
│                                              │
│  - BaseRepository (CRUD operations)          │
│  - UserRepository                            │
│  - ProductRepository                         │
│  - AuctionRepository                         │
│  - BidRepository                             │
│  - PaymentRepository                         │
│  - DatabaseManager (Connection pooling)      │
└──────────────────────────────────────────────┘
         │
         │ (Uses)
         ▼
┌──────────────────────────────────────────────┐
│         DATABASE LAYER                       │
│  (SQL Server with mssql package)             │
│                                              │
│  - Users                                     │
│  - Products                                  │
│  - Auctions                                  │
│  - Bids                                      │
│  - Payments                                  │
│  - UserRoles, Roles, etc.                    │
└──────────────────────────────────────────────┘

     │
     │ (Caches data in)
     ▼
┌──────────────────────────────────────────────┐
│       SUPPORTING SYSTEMS                     │
│                                              │
│  - CACHE SERVICE (In-memory)                 │
│  - LOGGER                                    │
│  - ERROR HANDLING                            │
│  - UTILS (Formatters, Validators, Crypto)    │
│  - CONSTANTS & ENUMS                         │
└──────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── app.js                      # Express app configuration
├── server.js                   # Entry point
│
├── config/
│   └── index.js               # Configuration management (all env vars)
│
├── constants/
│   └── index.js               # Enums & constants (Status, Roles, etc)
│
├── errors/
│   ├── BaseError.js           # Base error class
│   ├── ValidationError.js
│   ├── NotFoundError.js
│   ├── UnauthorizedError.js
│   ├── ForbiddenError.js
│   ├── DatabaseError.js
│   ├── ConflictError.js
│   └── index.js               # Central export
│
├── logger/
│   ├── Logger.js              # Logging service with levels
│   └── index.js               # Singleton getter
│
├── utils/
│   ├── formatter.js           # String/value formatting (formatVND, maskName, etc)
│   ├── validator.js           # Input validation (email, password, amounts, etc)
│   ├── crypto.js              # Encryption, JWT, password hashing
│   └── index.js               # Central export
│
├── middleware/
│   ├── auth.js                # JWT auth, authorization middleware
│   ├── errorHandler.js        # Global error handler, 404 handler
│   ├── logger.js              # Request logging middleware
│   └── index.js               # Central export
│
├── repositories/              # Data Access Layer (Repository Pattern)
│   ├── DatabaseManager.js     # Connection pooling & DB manager
│   ├── BaseRepository.js      # Abstract CRUD operations
│   ├── UserRepository.js      # User data operations
│   ├── ProductRepository.js   # Product data operations
│   ├── AuctionRepository.js   # Auction data operations
│   ├── BidRepository.js       # Bid data operations
│   ├── PaymentRepository.js   # Payment data operations
│   └── index.js               # Central export with singletons
│
├── services/                  # Business Logic Layer
│   ├── AuthService.js         # Authentication & user management
│   ├── ProductService.js      # Product business logic
│   ├── AuctionService.js      # Auction business logic
│   ├── BiddingService.js      # Bidding & validation logic
│   ├── PaymentService.js      # Payment processing logic
│   ├── SchedulerService.js    # Cron jobs (process ended auctions)
│   ├── CacheService.js        # In-memory caching
│   └── index.js               # Central export with singletons
│
├── routes/                    # API Routes/Controllers (Thin Controllers)
│   ├── auth.js                # /api/auth routes
│   ├── auction.js             # /api/auctions routes
│   ├── product.js             # /api/products routes
│   ├── bid.js                 # /api/bids routes
│   ├── payment.js             # /api/payments routes
│   └── index.js               # Route registration
│
└── websocket/                 # Real-time WebSocket Handlers
    ├── index.js               # WebSocket initialization
    └── handlers/
        ├── AuctionHandler.js  # Auction events (bid, join, etc)
        └── ConnectionHandler.js # Connection lifecycle events
```

## Key Design Patterns

### 1. **Singleton Pattern**
Configuration, Logger, and Services are singletons - only one instance throughout the app.

```javascript
let instance = null;

function getService() {
  if (!instance) {
    instance = new Service();
  }
  return instance;
}
```

### 2. **Repository Pattern**
All database access goes through repositories. Repositories abstract away database details.

```javascript
// Service uses repository
const user = await userRepository.findByEmail(email);

// Repository handles SQL
class UserRepository extends BaseRepository {
  async findByEmail(email) {
    // Execute SQL and return data
  }
}
```

### 3. **Service Layer Pattern**
Business logic is encapsulated in services. Routes are thin orchestrators.

```javascript
// Route (thin)
router.post('/bid', authenticate, async (req, res) => {
  const bid = await biddingService.placeBid(auctionId, userId, amount);
  res.json(bid);
});

// Service (thick - contains business logic)
async placeBid(auctionId, userId, amount) {
  // Validation
  // Bid checks
  // Database updates
  // Event emissions
  // Logging
}
```

### 4. **Middleware Pattern**
Express middleware for cross-cutting concerns (auth, logging, error handling).

```javascript
// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  req.user = authService.verifyToken(token);
  next();
};

// Error handler middleware (should be last!)
app.use(errorHandler);
```

### 5. **Custom Error Classes**
Errors carry metadata for proper HTTP response mapping.

```javascript
throw new ValidationError('Email is invalid', 400);
throw new NotFoundError('Product', productId);
throw new UnauthorizedError('Invalid credentials');

// Middleware catches and converts to proper HTTP response
```

## Data Flow Example: Placing a Bid

```
Client Request: POST /api/auctions/5/bid { "amount": 150000 }
        │
        ▼
Middleware: authenticate (verifies JWT, extracts userId)
        │
        ▼
Route Handler: (Orchestrates)
    - Extract data from request
    - Call service: biddingService.placeBid(auctionId, userId, amount)
        │
        ▼
BiddingService: (Business Logic)
    - Validate bid amount
    - Query auction via repository
    - Check auction is active
    - Check bid increment rules
    - Create bid via repository
    - Update auction current bid
    - Emit WebSocket event
        │
        ▼
Repository: (Data Access)
    - Execute SQL INSERT for bid
    - Execute SQL UPDATE for auction
    - Return results
        │
        ▼
Service returns result to Route Handler
        │
        ▼
Route Handler sends response to client
        │
        ▼
WebSocket Handler emits to all clients in auction room
```

## Key Improvements Over Old Code

### ❌ OLD CODE Problems

```javascript
// server.js - Everything mixed together
const express = require('express');
const app = express();

app.post('/api/bid', verifyToken, async (req, res) => {
  try {
    const pool = await sql.connect();
    const auction = await pool.request()
      .input('id', req.params.id)
      .query('SELECT * FROM Auctions WHERE Id = @id');
    
    if (!auction) res.status(404).json({ error: 'Not found' });
    else if (auction.Status !== 'Active') res.status(400).json({ error: 'Ended' });
    else {
      const bid = req.body.amount;
      if (bid < auction.CurrentBid * 1.05) {
        res.status(400).json({ error: 'Bid too low' });
      } else {
        await pool.request()
          .input('id', auction.Id)
          .input('bid', bid)
          .input('userId', req.user.id)
          .query('UPDATE Auctions SET CurrentBid = @bid, HighestBidderId = @userId WHERE Id = @id');
        
        io.to(`auction:${auction.Id}`).emit('bid:placed', { bid, userId: req.user.id });
        res.json({ success: true });
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
```

**Problems:**
- ❌ Route handler has all business logic
- ❌ Direct SQL in route
- ❌ No validation/error classes
- ❌ Hard to test
- ❌ Code duplication across routes
- ❌ Secrets hardcoded
- ❌ No logging
- ❌ Tight coupling to database

### ✅ NEW CODE Solution

```javascript
// Route (thin)
router.post('/:id/bid', authenticate, async (req, res, next) => {
  try {
    const bid = await biddingService.placeBid(
      parseInt(req.params.id),
      req.userId,
      parseFloat(req.body.amount)
    );
    res.status(201).json({ success: true, data: bid });
  } catch (error) {
    next(error); // Centralized error handling
  }
});

// Service (where logic lives)
async placeBid(auctionId, userId, bidAmount) {
  // Validation
  bidAmount = validatePositiveNumber(bidAmount, 'Bid amount');
  
  // Fetch data via repository
  const auction = await this.auctionRepository.findById(auctionId);
  if (!auction) throw new NotFoundError('Auction', auctionId);
  
  // Business logic
  if (auction.Status !== AUCTION_STATUS.ACTIVE) {
    throw new ValidationError('Auction is not active');
  }
  
  const minimumBid = auction.CurrentBid * VALIDATION.BID_INCREMENT_MULTIPLIER;
  if (bidAmount < minimumBid) {
    throw new ValidationError(`Bid must be at least ${minimumBid}`);
  }
  
  // Persist via repository
  const bidId = await this.bidRepository.create({ ... });
  await this.auctionRepository.update(auctionId, { ... });
  
  // Logging
  this.logger.info(`Bid placed: ${bidId}`);
  
  return { bidId, auctionId, userId, amount: bidAmount };
}

// Repository (abstracts database)
async findById(id) {
  const request = this.db.createRequest();
  request.input('id', id);
  const result = await request.query('SELECT * FROM Auctions WHERE Id = @id');
  return result.recordset[0];
}
```

**Benefits:**
- ✅ Separation of concerns
- ✅ Validation layer with custom errors
- ✅ Easy to test (services don't depend on route handlers)
- ✅ Repository abstracts database (can swap SQL Server for MongoDB)
- ✅ Centralized error handling
- ✅ Proper logging
- ✅ Configuration from environment
- ✅ Code reusability

## Error Handling Flow

```
Error thrown in service
        │
        ▼
Custom error class (ValidationError, NotFoundError, etc)
        │
        ▼
Route catches and calls next(error)
        │
        ▼
errorHandler middleware:
  - Checks if BaseError instance
  - Maps statusCode to HTTP response
  - Returns JSON with error details
        │
        ▼
Client receives HTTP response with error
```

## Testing Strategy

With this architecture, testing is much easier:

```javascript
// Test a service without Express/HTTP
describe('BiddingService', () => {
  let service;
  let mockBidRepository;
  let mockAuctionRepository;

  beforeEach(() => {
    mockBidRepository = {
      create: jest.fn(),
      getHighestBid: jest.fn()
    };
    mockAuctionRepository = {
      findById: jest.fn(),
      update: jest.fn()
    };
    service = new BiddingService();
    service.bidRepository = mockBidRepository;
    service.auctionRepository = mockAuctionRepository;
  });

  test('should place bid successfully', async () => {
    mockAuctionRepository.findById.mockResolvedValue({
      Id: 1,
      Status: 'Active',
      CurrentBid: 100,
      EndTime: new Date(Date.now() + 1000000)
    });
    mockBidRepository.create.mockResolvedValue(1);

    const result = await service.placeBid(1, 2, 110);

    expect(result.bidId).toBe(1);
    expect(mockBidRepository.create).toHaveBeenCalled();
  });

  test('should throw error if bid too low', async () => {
    mockAuctionRepository.findById.mockResolvedValue({
      Status: 'Active',
      CurrentBid: 100,
      EndTime: new Date(Date.now() + 1000000)
    });

    await expect(service.placeBid(1, 2, 105)).rejects.toThrow(ValidationError);
  });
});
```

## Configuration Management

All environment-specific settings are loaded from `.env`:

```javascript
// Getting config values
const config = getConfig();
const dbServer = config.get('DATABASE.SERVER');
const jwtSecret = config.get('JWT.SECRET');

// In services
class AuthService {
  constructor() {
    this.jwtSecret = getConfig().get('JWT.SECRET');
  }
}
```

Type-safe configuration with validation:

```javascript
// src/config/index.js validates all required fields at startup
- Checks critical values are set
- Logs warnings in development if missing
- Throws in production if critical values missing
```

## Logging

Consistent logging throughout:

```javascript
const logger = getLogger('ServiceName');

logger.debug('Debug message');    // Only if LOG_LEVEL=DEBUG
logger.info('Info message');      // INFO level and above
logger.warn('Warning message');   // WARN level and above
logger.error('Error', errorObj);  // ERROR level and above
```

## WebSocket Real-time Updates

Auctions can have real-time bid updates:

```javascript
// Client connects to auction room
socket.emit('auction:join', { auctionId: 5 });

// Client places bid
socket.emit('bid:place', { auctionId: 5, amount: 150000 });

// Server receives, validates, updates database
// All connected clients in room get update
socket.to('auction:5').emit('bid:placed', {
  bidId: 123,
  amount: 150000,
  timestamp: new Date()
});
```

This architecture provides:
- **Maintainability** - Code is organized and easy to understand
- **Testability** - Services can be tested independently
- **Scalability** - Easy to add new features
- **Security** - Proper validation and error handling
- **Performance** - Caching, connection pooling, logging
