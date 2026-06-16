# AI Startup Idea Validator

A full-stack web app that validates startup ideas with Google Gemini and now includes JWT authentication, PostgreSQL user accounts, and a protected dashboard.

## Features

- Submit startup idea data (title, description, target audience)
- Sends request to a Node.js/Express backend with Gemini API
- Generates AI analysis with:
  - Market demand assessment
  - Competitor analysis
  - Revenue model suggestions
  - SWOT analysis
  - Improvement suggestions
- Displays analysis in a clean, sectioned UI
- Powered by Google Gemini (Generative Language API)
- User signup and login with bcrypt password hashing
- JWT-based authentication
- PostgreSQL user storage
- Protected dashboard route and dashboard page
- Logout via localStorage token removal
- Responsive Tailwind UI for login and signup pages

## Getting Started

### 1) Clone / download

```bash
cd ai-startup-idea-validator
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure Gemini API Key

Create a `.env` file in the `app/` directory and add your Google Gemini API key:

```
PORT=5000

DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=startup_ai

JWT_SECRET=mysecretkey

GEMINI_API_KEY=your-api-key-here
GEMINI_MODEL=gemini-1.5-flash
```

You can copy [`.env.example`](.env.example) and fill in real values.

### 4) Create the PostgreSQL table

Run this once in your `startup_ai` database:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**To get your Gemini API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Create an API key for the Generative Language API
3. Copy the key and paste it into `.env`

### 5) Run the app

```bash
npm start
```

Then open http://localhost:3000 in your browser.

For the new auth pages and dashboard, open:

- http://localhost:5000/login.html
- http://localhost:5000/signup.html
- http://localhost:5000/dashboard.html

## Project Structure

- `server.js` - Express backend with Google Gemini API integration
- `config/db.js` - PostgreSQL connection pool and table bootstrap
- `routes/authRoutes.js` - Signup and login APIs
- `routes/dashboardRoutes.js` - Protected dashboard example route
- `middleware/authMiddleware.js` - JWT verification middleware
- `public/index.html` - Frontend form + result view
- `public/script.js` - Frontend JavaScript fetch logic
- `public/styles.css` - Basic styling
- `public/login.html` - Login page
- `public/signup.html` - Signup page
- `public/dashboard.html` - Protected dashboard page
- `public/auth.js` - Shared auth page logic
- `public/dashboard.js` - Dashboard data loading and logout logic

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `DB_USER` | Yes | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | Yes | - | PostgreSQL password |
| `DB_HOST` | No | `localhost` | PostgreSQL host |
| `DB_PORT` | No | `5432` | PostgreSQL port |
| `DB_NAME` | Yes | `startup_ai` | PostgreSQL database name |
| `JWT_SECRET` | Yes | - | Secret used to sign JWT tokens |
| `GEMINI_API_KEY` | Yes | - | Your Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | The Gemini model to use |

---

> The app requires a valid Gemini API key to function. If the API key is not set, the `/api/analyze` endpoint will return an error.

> The auth features require PostgreSQL to be running and reachable with the credentials in `.env`.
