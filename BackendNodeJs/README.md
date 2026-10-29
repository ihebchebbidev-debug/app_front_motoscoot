# MotoScoot API

## Quick Start

```bash
cp .env.example .env    # Configure your Neon DB URL
npm install
npm run migrate          # Create tables
npm start                # Production
npm run dev              # Development (auto-reload)
```

## Deploy

**Docker:**
```bash
docker build -t motoscoot-api .
docker run -p 4000:4000 --env-file .env motoscoot-api
```

**PM2:**
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

## Structure

```
├── migrations/          # SQL migration files (sequential)
├── seeds/               # Seed data
├── src/
│   ├── config/          # DB connection, migration runner
│   ├── controllers/     # Request handlers
│   ├── middlewares/      # Auth, error handling
│   ├── models/          # Data access layer
│   ├── routes/          # Route definitions
│   ├── services/        # Business logic
│   └── utils/           # Logger, helpers
├── uploads/             # User uploads
├── server.js            # Entry point
└── ecosystem.config.js  # PM2 config
```
