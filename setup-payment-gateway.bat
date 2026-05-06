@echo off
REM Payment Gateway Setup Script for BantuSesama (Windows)
REM This script sets up Stripe integration

echo.
echo ================================
echo BantuSesama Payment Gateway Setup
echo ================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo.
    echo Error: package.json not found. Please run this script from the project root.
    pause
    exit /b 1
)

REM Step 1: Install Frontend Packages
echo Installing frontend Stripe packages...
call npm install @stripe/js @stripe/react-stripe-js --save
if %errorlevel% equ 0 (
    echo.
    echo [OK] Frontend packages installed successfully
) else (
    echo.
    echo [WARNING] npm install had issues. You may need to install manually:
    echo            npm install @stripe/js @stripe/react-stripe-js
)

echo.

REM Step 2: Check backend packages
cd server
echo Checking backend dependencies...
npm list stripe >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Stripe backend package already installed
) else (
    echo Installing Stripe backend package...
    call npm install stripe --save
)
cd ..

echo.

REM Step 3: Setup environment files
echo Setting up environment files...

REM Backend .env
if not exist "server\.env" (
    echo Creating server\.env from server\.env.example...
    copy server\.env.example server\.env >nul
    echo [WARNING] Please update server\.env with your Stripe keys:
    echo           - STRIPE_SECRET_KEY
    echo           - STRIPE_PUBLISHABLE_KEY
    echo           - STRIPE_WEBHOOK_SECRET
) else (
    echo [OK] server\.env already exists
)

REM Frontend .env
if not exist ".env.local" (
    echo Creating .env.local...
    (
        echo VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
        echo VITE_API_URL=http://localhost:4000
    ) > .env.local
    echo [WARNING] Please update .env.local with your Stripe publishable key
) else (
    echo [OK] .env.local already exists
)

echo.
echo ================================
echo [OK] Setup Complete!
echo ================================
echo.
echo Next steps:
echo 1. Add your Stripe keys to server\.env and .env.local
echo 2. Run: npm run dev:all
echo 3. Test payment at http://localhost:8080
echo.
echo Test card: 4242 4242 4242 4242
echo Expiry: Any future date
echo CVV: Any 3 digits
echo.
echo Documentation: See STRIPE_INTEGRATION.md and PAYMENT_GATEWAY_SETUP.md
echo.
pause
