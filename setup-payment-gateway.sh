#!/bin/bash
# Payment Gateway Setup Script for BantuSesama
# This script sets up Stripe integration

echo "================================"
echo "BantuSesama Payment Gateway Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Step 1: Install Frontend Packages
echo "📦 Installing frontend Stripe packages..."
if npm install @stripe/js @stripe/react-stripe-js --save; then
    echo "✅ Frontend packages installed successfully"
else
    echo "⚠️  Warning: npm install had issues. You may need to install manually:"
    echo "   npm install @stripe/js @stripe/react-stripe-js"
fi

echo ""

# Step 2: Check backend packages
cd server
echo "📦 Checking backend dependencies..."
if npm list stripe > /dev/null 2>&1; then
    echo "✅ Stripe backend package already installed"
else
    echo "📦 Installing Stripe backend package..."
    npm install stripe --save
fi
cd ..

echo ""

# Step 3: Setup environment files
echo "📝 Setting up environment files..."

# Backend .env
if [ ! -f "server/.env" ]; then
    echo "Creating server/.env from server/.env.example..."
    cp server/.env.example server/.env
    echo "⚠️  Please update server/.env with your Stripe keys:"
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_PUBLISHABLE_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
else
    echo "✅ server/.env already exists"
fi

# Frontend .env
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local..."
    cat > .env.local << 'EOF'
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
VITE_API_URL=http://localhost:4000
EOF
    echo "⚠️  Please update .env.local with your Stripe publishable key"
else
    echo "✅ .env.local already exists"
fi

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Add your Stripe keys to server/.env and .env.local"
echo "2. Run: npm run dev:all"
echo "3. Test payment at http://localhost:8080"
echo ""
echo "Test card: 4242 4242 4242 4242"
echo "Expiry: Any future date"
echo "CVV: Any 3 digits"
echo ""
echo "Documentation: See STRIPE_INTEGRATION.md and PAYMENT_GATEWAY_SETUP.md"
