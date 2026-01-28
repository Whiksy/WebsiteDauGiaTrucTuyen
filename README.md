# Real-time Auction System

A Node.js-based real-time auction system using Socket.io for live bidding, Redis for caching, and SQL Server for data persistence. Includes JWT authentication, OAuth integration (Google/Facebook), and Momo payment gateway.

## Features

- **Real-time Bidding**: Live auction updates using Socket.io
- **Authentication**: JWT-based auth with OAuth support
- **Caching**: Redis for product details and stock management
- **Payments**: Integration with Momo payment API
- **Database**: SQL Server with Identity-like user management

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up SQL Server database:
   - Create the database `AuctionDB` and run the script in `database/schema.sql` to create tables and seed data.
   - You can run the migration helper included in the project:

   ```bash
   npm run migrate
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` and update values (especially the DB connection string and `JWT_SECRET`).

4. Start Redis server (if not running). You can use Docker:

```bash
docker run -p 6379:6379 --name redis -d redis:7
```

5. Start the application:
   ```bash
   npm start
   ```

6. If server port is busy it will auto-retry on next ports (3000 -> 3001 -> ...).

7. Open the site in your browser (example):

```
http://localhost:3000
```

If the server auto-picked another port you'll see the actual host:port in the server logs.


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