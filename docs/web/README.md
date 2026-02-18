# TripGenie Backend

AI-powered travel planning app backend built with Node.js, Express, TypeScript, and PostgreSQL.

## 🚀 Features

- **RESTful API** - Clean, well-documented endpoints
- **JWT Authentication** - Secure user authentication
- **PostgreSQL Database** - Robust data storage with migrations
- **TypeScript** - Type-safe codebase with strict mode
- **Input Validation** - Zod schemas for request validation
- **Structured Logging** - Pino logger with pretty output in development
- **Error Handling** - Centralized error handling with consistent responses
- **Security** - Helmet, CORS, bcrypt password hashing

## 📋 Prerequisites

- Node.js 18+ (recommended: 20+)
- PostgreSQL 14+
- npm or yarn

## 🛠️ Setup

### 1. Clone and Install Dependencies

```bash
cd tripgenie/backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/tripgenie

# JWT (generate a secure random string for production!)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Set Up the Database

Create the PostgreSQL database:

```bash
createdb tripgenie
# or using psql:
psql -U postgres -c "CREATE DATABASE tripgenie;"
```

Run migrations:

```bash
npm run migrate
```

### 4. Start the Server

Development mode (with hot reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## 📚 API Endpoints

### Health Check

| Method | Endpoint       | Description        |
| ------ | -------------- | ------------------ |
| GET    | `/api/health`  | Check API status   |

### Authentication

| Method | Endpoint                  | Description              | Auth Required |
| ------ | ------------------------- | ------------------------ | ------------- |
| POST   | `/api/auth/register`      | Register a new user      | No            |
| POST   | `/api/auth/login`         | Login and get JWT token  | No            |
| GET    | `/api/auth/me`            | Get current user profile | Yes           |
| PUT    | `/api/auth/me`            | Update user profile      | Yes           |
| POST   | `/api/auth/change-password` | Change password        | Yes           |

### Trips

| Method | Endpoint              | Description                | Auth Required |
| ------ | --------------------- | -------------------------- | ------------- |
| GET    | `/api/trips`          | List all user trips        | Yes           |
| POST   | `/api/trips`          | Create a new trip          | Yes           |
| GET    | `/api/trips/upcoming` | Get upcoming trips         | Yes           |
| GET    | `/api/trips/stats`    | Get trip statistics        | Yes           |
| GET    | `/api/trips/:id`      | Get trip by ID             | Yes           |
| PUT    | `/api/trips/:id`      | Update a trip              | Yes           |
| DELETE | `/api/trips/:id`      | Delete a trip              | Yes           |

## 📝 API Examples

### Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "SecurePass123"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

### Create a Trip

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "destination": "Tokyo, Japan",
    "start_date": "2026-06-01",
    "end_date": "2026-06-10",
    "budget": 3000
  }'
```

### List Trips

```bash
curl http://localhost:3000/api/trips \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🗄️ Database

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Rollback last migration
npm run migrate:down
```

### Database Schema

See [docs/schema.md](docs/schema.md) for detailed schema documentation.

## 🧪 Development

### Available Scripts

| Script         | Description                          |
| -------------- | ------------------------------------ |
| `npm run dev`  | Start development server with watch  |
| `npm run build`| Build for production                 |
| `npm start`    | Start production server              |
| `npm run lint` | Run ESLint                           |
| `npm run lint:fix` | Run ESLint with auto-fix         |
| `npm run format` | Format code with Prettier          |
| `npm run migrate` | Run database migrations           |
| `npm run test` | Run tests                            |

### Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration (env, database, logger)
│   ├── controllers/    # HTTP request handlers
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   └── index.ts        # Application entry point
├── migrations/         # SQL migration files
├── docs/               # Documentation
└── package.json
```

## 🔒 Security

- Passwords are hashed using bcrypt with configurable salt rounds
- JWT tokens for stateless authentication
- Helmet.js for HTTP security headers
- CORS configuration for controlled access
- Input validation on all endpoints
- SQL injection prevention through parameterized queries

## 🚧 Future Enhancements (Task 2: AI Integration)

The backend is designed to be ready for AI integration:

- User preferences stored for personalized recommendations
- Itineraries support structured activities (JSON format)
- Placeholder for AI service integration (OpenAI/Anthropic)

## 📄 License

MIT
