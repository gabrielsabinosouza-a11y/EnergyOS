# EnergyOS Debugging Guide

## Recent Changes Made

### 1. Reports Page Implementation ✅
- Created comprehensive `/relatorio` page with data visualizations
- Added Recharts library for beautiful charts
- Implemented `/api/relatorio` endpoint for data aggregation
- Connected dashboard "Ver relatório" button to the new page
- Added time range toggle (7 days / 30 days)

### 2. Debugging Infrastructure ✅
- Added comprehensive logging to all API endpoints
- Enhanced error handling with detailed console logs
- Added database connection monitoring
- Created `/api/test` endpoint for diagnostics
- Improved error messages in the http handler

### 3. Goals Page UI Improvements ✅
- Fixed "Valor alvo" → "Quantidade" label
- Improved progress control UI with better buttons
- Added click-to-set functionality for values
- Added dedicated -5/+5 buttons for faster adjustments
- Enhanced visual feedback and interactions

## How to Debug the 500 Errors

### Step 1: Test the API Endpoint
Visit `/api/test` in your browser or use curl:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/test
```

This will verify:
- Authentication is working
- Database connection is functional
- Profile exists in the database

### Step 2: Check Console Logs
The following endpoints now have detailed logging:
- `/api/checkins` (POST) - Check-in saving
- `/api/tasks` (POST, PATCH, DELETE) - Task operations
- `/api/dashboard` - Dashboard data loading
- `/api/relatorio` - Reports data aggregation

Look for logs like:
```
[checkins POST] Attempting to save checkin for profile: xxx
[checkins db] Attempting to upsert checkin: {...}
[checkins db] Checkin upserted successfully: {...}
```

### Step 3: Check Database Connection
Logs will show:
```
[db] Database connection string configured: Yes
[db] Database pool created
[db] New client connected
```

If you see connection errors, check your `DATABASE_URL` in `.env`.

### Step 4: Verify Authentication
Logs will show:
```
[auth] Token found, attempting verification
[auth] Token verified successfully for UID: xxx
```

If you see "No token found", the frontend isn't sending the auth token properly.

## Common Issues and Solutions

### Issue: "DATABASE_URL não configurada"
**Solution**: Ensure `.env` file exists with `DATABASE_URL=postgresql://...`

### Issue: "Autenticação não configurada no servidor"
**Solution**: Ensure Firebase environment variables are set in `.env`

### Issue: "Perfil não encontrado"
**Solution**: The user profile doesn't exist in the database. The system should auto-create profiles on first auth.

### Issue: Database SSL errors with Neon
**Solution**: The SSL configuration is already handled in `src/lib/db.ts` with `rejectUnauthorized: false` for Neon connections.

### Issue: Token verification failures
**Solution**: Check that `NEXT_PUBLIC_FIREBASE_API_KEY` is correct and the Firebase project is properly configured.

## Testing Checklist

### Authentication Flow
- [ ] Can login with email/password
- [ ] Can login with Google
- [ ] Token is stored and sent with API requests
- [ ] Profile is auto-created on first login

### Check-in Operations
- [ ] Can save daily check-in
- [ ] Check-in data is stored in database
- [ ] Check-in data appears in dashboard
- [ ] Check-in data appears in reports

### Task Operations
- [ ] Can create new task
- [ ] Can edit existing task
- [ ] Can mark task as completed
- [ ] Can delete task
- [ ] Task changes persist across page refreshes

### Dashboard
- [ ] Dashboard loads without errors
- [ ] Tasks display correctly
- [ ] Metrics show accurate data
- [ ] Check-in form works
- [ ] "Ver relatório" button works

### Reports Page
- [ ] Reports page loads without errors
- [ ] Charts display correctly
- [ ] Time range toggle works
- [ ] Data is accurate and up-to-date

## Development Tools

### Browser Console
Open browser DevTools (F12) and check:
- Console tab for client-side errors
- Network tab for API request/response details
- Application tab for cookies and local storage

### Server Logs
Check the terminal where `npm run dev` is running for:
- Database connection logs
- Authentication logs
- API request logs
- Error details

### Database Direct Access
You can query the database directly to verify data:
```sql
-- Check if profiles exist
SELECT * FROM profiles;

-- Check checkins
SELECT * FROM daily_checkins ORDER BY checkin_date DESC;

-- Check tasks
SELECT * FROM tasks ORDER BY due_date DESC;

-- Check goals
SELECT * FROM goals;
```

## Next Steps for opencode

1. **Review the logs** when errors occur to identify the exact failure point
2. **Test the `/api/test` endpoint** to verify basic functionality
3. **Check authentication flow** to ensure tokens are being sent correctly
4. **Verify database operations** are working as expected
5. **Test each API endpoint individually** using tools like Postman or curl

## Environment Variables Checklist

Ensure these are set in your `.env` file:

```env
# Firebase (REQUIRED)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAyI5gYrdWM5_G6Wu4k3MKlCkNU1stcLPU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=energyos-bb7fd.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=energyos-bb7fd
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=energyos-bb7fd.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=715680979332
NEXT_PUBLIC_FIREBASE_APP_ID=1:715680979332:web:0f9825c69a544937ce25d1
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-RJS07J2D7D

# Database (REQUIRED)
DATABASE_URL=postgresql://neondb_owner:npg_L6yXgb5BDdZi@ep-snowy-hill-acvp766i-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Application (REQUIRED)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Performance Monitoring

The logging I've added will help identify:
- Slow database queries
- Authentication delays
- API response times
- Memory usage patterns

Monitor these in the development server logs to optimize performance.

## Security Notes

- The logging includes user IDs for debugging but not sensitive data
- Remove detailed logging before production deployment
- Ensure `.env` file is never committed to version control
- Rotate API keys periodically

---

**Status**: Ready for testing with enhanced debugging capabilities
**Next Action**: Test the application and check console logs for any errors