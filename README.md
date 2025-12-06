# Azevedo Medical Services - Backend API

REST API for the Post-Consultation Management System.

## Tech Stack

- **Node.js** + **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Swagger** - API Documentation

## Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Setup database:**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # Seed initial data
   npm run db:seed
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with initial data |
| `npm run db:studio` | Open Prisma Studio |

## API Documentation

When the server is running, access Swagger UI at:
- http://localhost:3001/api-docs

## Default Users (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@azevedo.com | admin123 | ADMIN |
| medico@azevedo.com | doctor123 | DOCTOR |
| secretaria@azevedo.com | secretary123 | SECRETARY |

## API Endpoints

See [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md) for complete API reference.

### Main Routes

- `POST /api/auth/login` - Authenticate user
- `GET /api/patients` - List patients
- `GET /api/treatments` - List treatments
- `GET /api/doses` - List doses
- `GET /api/inventory` - List inventory
- `GET /api/dashboard/stats` - Get dashboard statistics

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Seed data
├── src/
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── index.ts         # Application entry point
├── .env                 # Environment variables
├── package.json
└── tsconfig.json
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for JWT tokens | - |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `PORT` | Server port | 3001 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |
