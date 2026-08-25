# EnergyOS Collaboration Prompt for opencode

## Project Overview
EnergyOS is a personal productivity and wellness tracking application built with Next.js, Firebase Authentication, PostgreSQL (Neon), and TypeScript. The app focuses on daily check-ins, task management, goals/habits tracking, and generating insights for personal improvement.

## Current Architecture

### Tech Stack
- **Frontend**: Next.js 16.3.2, React 19.2.8, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API routes with PostgreSQL database
- **Authentication**: Firebase Authentication (Google + Email/Password)
- **Database**: PostgreSQL via Neon (cloud-hosted)
- **Icons**: Lucide React
- **Deployment**: Next.js (with potential Docker support)

### Project Structure
```
EnergyOS/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── (auth)/            # Authentication pages (login, cadastro)
│   │   ├── api/               # API routes
│   │   │   ├── checkins/      # Daily check-in endpoints
│   │   │   ├── tasks/         # Task CRUD operations
│   │   │   ├── goals/         # Goals and habits endpoints
│   │   │   ├── dashboard/     # Dashboard data aggregation
│   │   │   ├── profile/       # User profile management
│   │   │   ├── settings/      # User settings
│   │   │   └── insights/      # AI-generated insights
│   │   ├── dashboard/         # Main dashboard page
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── app-shell.tsx      # Main app layout wrapper
│   │   ├── dashboard.tsx      # Dashboard components
│   │   └── navigation.tsx     # Navigation components
│   ├── lib/                   # Core libraries
│   │   ├── auth-context.tsx   # Firebase auth context
│   │   ├── firebase.ts        # Firebase configuration
│   │   ├── server-auth.ts     # Server-side auth verification
│   │   ├── db.ts              # Database connection pool
│   │   ├── db/                # Database operations
│   │   │   ├── checkins.ts    # Check-in CRUD
│   │   │   ├── tasks.ts       # Task CRUD and streak logic
│   │   │   ├── goals.ts       # Goals and habits
│   │   │   ├── profiles.ts    # User profile management
│   │   │   ├── dashboard.ts   # Dashboard data aggregation
│   │   │   └── validation.ts  # Input validation
│   │   ├── api-client.ts      # Frontend API client
│   │   ├── http.ts            # HTTP utilities
│   │   └── errors.ts          # Error handling
│   ├── db-schema.sql          # Database schema
│   └── types.ts               # TypeScript type definitions
├── scripts/
│   └── init-db.mjs           # Database initialization script
├── .env                      # Environment variables (Firebase, Neon, etc.)
└── package.json              # Dependencies and scripts
```

## Current Issues Identified

### 1. API Error Handling Issues
**Problem**: The `/api/checkins` endpoint returns 500 errors when users try to save check-ins, and similar issues affect task CRUD operations.

**Root Causes Identified**:
- Database connection issues potentially due to SSL configuration with Neon
- Authentication token validation may be failing silently
- Error handling in API routes may not be providing user-friendly messages
- Frontend error states not properly reflecting backend issues

**Files Affected**:
- `/src/app/api/checkins/route.ts` - Check-in endpoint
- `/src/app/api/tasks/route.ts` - Task CRUD operations
- `/src/lib/server-auth.ts` - Firebase token verification
- `/src/lib/db.ts` - Database connection setup

### 2. Authentication Flow
**Current Implementation**:
- Firebase Authentication for login (Google + Email/Password)
- Token-based auth with Bearer tokens in API requests
- Server-side token verification using Firebase Identity Toolkit API
- Session management via cookies
- Profile auto-creation on first auth

**Potential Issues**:
- Token verification may fail with invalid Firebase configuration
- Session cookie management may have timing issues
- Profile creation may fail silently

### 3. Database Schema & Operations
**Current Schema** (from `src/db-schema.sql`):
- `profiles` - User profiles
- `daily_checkins` - Daily wellness data (sleep, study, training, energy)
- `tasks` - Task management with completion tracking
- `goals` - Long-term goals with progress tracking
- `habits` - Recurring habits linked to goals
- `habit_completions` - Habit completion tracking
- `user_settings` - User preferences
- `insights` - AI-generated insights

**Database Status**: Schema successfully initialized on Neon database

## Collaboration Strategy

### Division of Responsibilities

#### opencode Focus Areas:
1. **API Debugging & Error Handling**
   - Implement comprehensive error logging in API routes
   - Add detailed error responses for debugging
   - Fix SSL/Neon connection issues if present
   - Add request/response logging for development

2. **Authentication System Improvements**
   - Enhance token verification error handling
   - Add fallback mechanisms for auth failures
   - Implement proper session management
   - Add auth state debugging utilities

3. **Database Operation Resilience**
   - Add connection pooling optimizations
   - Implement retry logic for transient database errors
   - Add database query logging for debugging
   - Validate all database operations

4. **Frontend Error State Management**
   - Improve error boundary implementation
   - Add user-friendly error messages
   - Implement proper loading states
   - Add error recovery mechanisms

#### Devin Focus Areas:
1. **Feature Implementation**
   - Complete task CRUD operations frontend
   - Implement drag-and-drop task organization
   - Add task filtering and sorting
   - Implement habit tracking UI improvements

2. **Dashboard Enhancements**
   - Improve metrics visualization
   - Add streak tracking improvements
   - Implement insights generation UI
   - Add data export functionality

3. **Testing & Quality Assurance**
   - Write API integration tests
   - Add end-to-end testing for critical flows
   - Implement performance monitoring
   - Add accessibility improvements

4. **Documentation & Maintenance**
   - Update API documentation
   - Create deployment guides
   - Implement CI/CD pipeline
   - Add monitoring and alerting

### Communication Protocol

1. **Daily Sync**: Brief status updates on blocked issues and progress
2. **Code Review**: All changes affecting shared components require review
3. **Issue Tracking**: Use GitHub issues for bug reports and feature requests
4. **Branch Strategy**: Feature branches with descriptive names
5. **Deployment Coordination**: Coordinate deployments to avoid conflicts

### Technical Guidelines

1. **Code Style**: Follow existing TypeScript and React patterns
2. **Error Handling**: Use existing error classes (`AppError`, `ValidationError`, etc.)
3. **Database Operations**: Use existing database functions and validation
4. **API Patterns**: Follow existing API route structure with `handleRoute` wrapper
5. **Authentication**: Always use `requireAuth` middleware for protected routes

### Environment Setup

Both developers need:
1. **Firebase Configuration**: Set up Firebase project with credentials in `.env`
2. **Neon Database**: Configure `DATABASE_URL` with Neon connection string
3. **Local Development**: Run `npm run dev` for development server
4. **Database Initialization**: Run `npm run db:init` to set up schema

### Priority Issues to Address

**High Priority** (Blocking User Experience):
1. Fix `/api/checkins` 500 errors
2. Resolve task creation/editing failures
3. Ensure authentication works reliably
4. Fix any database connection issues

**Medium Priority** (User Experience Improvements):
1. Improve error messages and user feedback
2. Add loading states for all async operations
3. Implement proper error recovery
4. Add form validation improvements

**Low Priority** (Enhancements):
1. Performance optimizations
2. Additional features and UI improvements
3. Analytics and monitoring
4. Documentation improvements

## Success Criteria

### Immediate Goals (Week 1):
- ✅ All API endpoints return proper error messages
- ✅ Check-in saving works reliably
- ✅ Task CRUD operations function correctly
- ✅ Authentication flow is stable
- ✅ Database operations are resilient

### Short-term Goals (Week 2-3):
- ✅ Enhanced error handling throughout the app
- ✅ Improved user feedback for all operations
- ✅ Comprehensive testing coverage
- ✅ Performance optimizations
- ✅ Documentation updates

### Long-term Goals (Month 1+):
- ✅ Feature-complete application
- ✅ Production-ready deployment
- ✅ Monitoring and alerting
- ✅ Scalable architecture
- ✅ User feedback integration

## Getting Started

### For opencode:
1. Clone the repository
2. Set up `.env` with Firebase and Neon credentials
3. Run `npm install` and `npm run db:init`
4. Start with debugging the `/api/checkins` endpoint
5. Add comprehensive error logging to all API routes
6. Test authentication flow thoroughly

### For Devin:
1. Review the current dashboard implementation
2. Identify missing frontend features
3. Implement task organization improvements
4. Add proper error boundaries and loading states
5. Test all user flows end-to-end

## Notes

- The project uses Firebase's public API key for token verification (no admin SDK required)
- Neon database SSL configuration is handled in `src/lib/db.ts`
- All database operations should use the existing validation and error handling
- The app uses Next.js App Router with API routes
- Frontend uses the `api-client.ts` for all API calls with automatic token injection

Let's collaborate to fix these issues and create a robust, user-friendly productivity application!