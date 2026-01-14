# Fuel Tracker

A Progressive Web App for tracking fuel consumption across multiple vehicles. Mobile-first design with location auto-detection for logging fillups quickly at the pump.

## Features

- **Quick Fillup Entry** — Log fillups in seconds at the pump with auto-detected location
- **Family Groups** — Share vehicles between household members
- **Vehicle Profiles** — Track multiple vehicles with photos and specifications
- **MPG Tracking** — Automatic fuel economy calculations and trends
- **Offline Support** — Works without internet, syncs when back online
- **Installable PWA** — Add to home screen on any device

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** Auth.js (NextAuth v5)
- **Styling:** Tailwind CSS 4
- **PWA:** Serwist (service worker)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker)

### Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and auth secret

# Run database migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/fuel_tracker"
AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3000"
```

## Docker

### Development (build locally)

```bash
docker-compose up -d
```

### Production (pull from GHCR)

```bash
# Create .env with required secrets
echo "POSTGRES_PASSWORD=secure-password" >> .env
echo "AUTH_SECRET=your-auth-secret" >> .env

# Run
docker-compose -f docker-compose.prod.yml up -d
```

### Pull image directly

```bash
docker pull ghcr.io/biker2000on/fuel-tracker:latest
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   ├── fillups/           # Fillup entry/edit pages
│   ├── groups/            # Family group management
│   ├── import/            # CSV import page
│   └── vehicles/          # Vehicle management
├── components/            # React components
├── lib/                   # Utilities (auth, db, geocoding)
└── generated/             # Prisma client
prisma/
├── schema.prisma          # Database schema
└── migrations/            # Database migrations
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | * | Authentication (Auth.js) |
| `/api/vehicles` | GET, POST | List/create vehicles |
| `/api/vehicles/[id]` | GET, PUT, DELETE | Vehicle CRUD |
| `/api/fillups` | GET, POST | List/create fillups |
| `/api/fillups/[id]` | GET, PUT, DELETE | Fillup CRUD |
| `/api/groups` | GET, POST | List/create groups |
| `/api/groups/join` | POST | Join group by code |
| `/api/import` | POST | Import fillups from CSV |
| `/api/dashboard` | GET | Dashboard statistics |

## CSV Import

Import historical fillup records from CSV files:

```csv
date,gallons,pricePerGallon,odometer,isFull,notes,city,state
2024-01-15,12.5,3.29,45000,true,Shell station,Seattle,WA
2024-01-22,11.8,3.35,45320,true,,Bellevue,WA
```

## License

MIT
