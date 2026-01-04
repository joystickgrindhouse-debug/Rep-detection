# AI Rep Counter Pro

## Overview

AI Rep Counter Pro is a mobile-first fitness web application that uses real-time pose detection via MediaPipe to automatically count exercise repetitions. The app features a "Solo Mode" gamified workout experience where users draw exercise cards and perform exercises while the AI tracks their form and counts reps. The application is designed to run primarily on-device with minimal backend requirements.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The application has a dual frontend structure:

1. **Standalone Vanilla JS App** (`client/index.html`, `client/app.js`, `client/style.css`)
   - Mobile-first, fullscreen layout optimized for iOS Safari and Android Chrome
   - Uses MediaPipe Pose for on-device pose detection via WASM
   - Canvas API for skeleton overlay rendering with mirrored front-camera video
   - Implements a state machine-based exercise engine for rep counting using joint angles and distances
   - Solo Mode gamification with card-based workout system (16 exercises across 4 categories)

2. **React Application** (`client/src/`)
   - Built with Vite and React
   - Uses shadcn/ui component library with Radix UI primitives
   - Tailwind CSS for styling with custom CSS variables for theming
   - TanStack Query for server state management
   - Wouter for client-side routing

### Backend Architecture

- **Express.js server** with TypeScript
- Minimal API surface - primarily serves static files and Firebase configuration
- Development uses Vite middleware for HMR
- Production builds static assets to `dist/public`

### Exercise Detection Engine

The pose tracking system:
- Uses MediaPipe Pose with configurable detection/tracking confidence thresholds
- Calculates joint angles and distances from body landmarks
- State machine tracks movement phases (UP/DOWN/HOLD/REP)
- Modular exercise logic map supports 16+ exercises across categories: Arms, Legs, Core, Cardio

### Build System

- Vite for frontend bundling with React plugin
- esbuild for server bundling with selective dependency bundling
- TypeScript throughout with path aliases (`@/`, `@shared/`)

## External Dependencies

### Pose Detection
- **MediaPipe Pose** - On-device human pose estimation (WASM-based)
- **MediaPipe Camera Utils** - Camera stream handling
- **MediaPipe Drawing Utils** - Skeleton visualization

### Database
- **PostgreSQL** with Drizzle ORM - Schema defined in `shared/schema.ts`
- Database migrations managed via `drizzle-kit`
- Currently uses in-memory storage as fallback (`MemStorage` class)

### Firebase Integration
- Optional Firebase integration for user stats persistence
- API key served securely via `/api/firebase-config` endpoint
- Firestore for workout session data storage

### UI Components
- **shadcn/ui** - Complete component library (40+ components)
- **Radix UI** - Accessible primitive components
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### State Management
- **TanStack Query** - Server state and caching
- **React Hook Form** with Zod validation