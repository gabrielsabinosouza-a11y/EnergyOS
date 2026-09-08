#!/bin/bash

# EnergyOS Vercel Environment Variables Setup Script
# This script sets up all environment variables using the Vercel CLI
# Usage: ./setup-vercel-env.sh [--token TOKEN]

set -e  # Exit on any error

# Parse command line arguments
TOKEN=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--token TOKEN]"
            exit 1
            ;;
    esac
done

echo "🚀 Setting up Vercel environment variables for EnergyOS..."
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null && ! npx vercel --version &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Please install it first:"
    echo "   npm install -g vercel"
    exit 1
fi

# Use npx vercel if vercel is not globally installed
VERCEL_CMD="vercel"
if ! command -v vercel &> /dev/null; then
    VERCEL_CMD="npx vercel"
fi

# Add token flag if provided
TOKEN_FLAG=""
if [ -n "$TOKEN" ]; then
    TOKEN_FLAG="--token $TOKEN"
    echo "🔑 Using provided authentication token"
fi

# Function to add environment variable
add_env_var() {
    local var_name=$1
    local var_value=$2
    local environments=$3
    
    echo "Adding $var_name..."
    echo "$var_value" | $VERCEL_CMD env add "$var_name" "$environments" $TOKEN_FLAG --yes
    echo "✅ $var_name added successfully"
}

echo "📋 Adding Firebase Configuration..."
add_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" "AIzaSyAyI5gYrdWM5_G6Wu4k3MKlCkNU1stcLPU" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "energyos-bb7fd.firebaseapp.com" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "energyos-bb7fd" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "energyos-bb7fd.firebasestorage.app" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "715680979332" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_APP_ID" "1:715680979332:web:0f9825c69a544937ce25d1" "production,preview,development"
add_env_var "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID" "G-RJS07J2D7D" "production,preview,development"

echo ""
echo "📋 Adding Cloudinary Configuration..."
add_env_var "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME" "dch7w7ncj" "production,preview,development"
add_env_var "CLOUDINARY_API_KEY" "146765563664891" "production,preview,development"
add_env_var "CLOUDINARY_API_SECRET" "GEVlzD4HQAPwZMevP8wS1S3Ne-A" "production,preview,development"
add_env_var "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET" "energy_pfp" "production,preview,development"

echo ""
echo "📋 Adding Resend Configuration..."
add_env_var "RESEND_API_KEY" "your_resend_api_key" "production,preview,development"
add_env_var "RESEND_FROM_EMAIL" "noreply@yourdomain.com" "production,preview,development"

echo ""
echo "📋 Adding Database Configuration..."
add_env_var "DATABASE_URL" "postgresql://neondb_owner:npg_L6yXgb5BDdZi@ep-snowy-hill-acvp766i-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" "production,preview,development"

echo ""
echo "📋 Adding Application Configuration..."
add_env_var "NEXT_PUBLIC_APP_URL" "http://localhost:3000" "production,preview,development"
add_env_var "NODE_ENV" "development" "production,preview,development"

echo ""
echo "✅ All environment variables have been added to Vercel!"
echo ""
echo "📌 Next steps:"
echo "   1. Run 'vercel env pull .env.local' to pull the variables locally"
echo "   2. Deploy with 'vercel --prod' to apply changes"
echo ""
echo "⚠️  Security Notes:"
echo "   - CLOUDINARY_API_SECRET is sensitive - keep it secure"
echo "   - DATABASE_URL contains credentials - keep it secure"
echo "   - Never commit these values to version control"
echo ""
echo "💡 Usage examples:"
echo "   ./setup-vercel-env.sh                          # Interactive login"
echo "   ./setup-vercel-env.sh --token YOUR_TOKEN      # Using token"
