# AS Traders - Urea Fertilizer Billing & Inventory System Backend

Regulated POS Billing & Audit Inventory Management System tailored for Urea Fertilizer dealerships operating under Asia/Karachi (PKT) business cycles.

## Features
- **Strict Business Session Hours:** Automatic synchronization with PKT (07:00 AM – 07:00 PM)
- **FIFO / Weighted Cost Accounting:** True profit & loss calculations based on purchase batch costs
- **Real-Time Stock Audit:** Immutable stock movement ledger for counter sales, purchases, and damage adjustments
- **JWT & Role-Based Access Control:** Secure endpoints with bcrypt password hashing
- **MongoDB Atlas Integration:** High-availability cloud database with connection pooling

## Tech Stack
- Node.js & Express.js
- MongoDB & Mongoose
- JSON Web Token (JWT) & bcryptjs
- Day.js (Asia/Karachi Timezone)

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env` using `.env.example`:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   TIMEZONE=Asia/Karachi
   FRONTEND_URL=http://localhost:5173
   ```
3. Run the server:
   ```bash
   npm run dev
   ```

Developed by **TechWave Software House**.
