
  # Micro-Crowdfunding Platform

  This is a code bundle for Micro-Crowdfunding Platform. The original project is available at https://www.figma.com/design/PImKgNRiIMLcIU2RnEX6ik/Micro-Crowdfunding-Platform.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend added to meet technical standards

  I added a minimal Node.js + Express backend in the `server/` folder to satisfy the requested technical standards:

  - Backend: Node.js (Express) with API endpoints in `server/routes`.
  - Database: Sequelize models for `User`, `Campaign`, `Donation`, `Comment`, `Category` (5 tables) with relations in `server/models`.
  - Security: Password hashing with `bcrypt`, JWT-based auth middleware in `server/middleware/auth.js`.
  - Integration: Stripe PaymentIntent endpoint at `POST /api/payments/create-intent` (test key via `STRIPE_SECRET_KEY`).
  - Deployment: `server/Dockerfile` and `docker-compose.yml` added to run Postgres + backend for public hosting.
  - HTTPS readiness: backend trusts reverse-proxy headers and redirects to HTTPS in production when `x-forwarded-proto` is not `https`.

  Setup quick start (backend):

  1. In `server/` run:

  ```bash
  npm install
  cp .env.example .env
  # edit .env to set STRIPE_SECRET_KEY and JWT_SECRET
  npm run dev
  ```

  2. Or with Docker Compose (from repo root):

  ```bash
  docker compose up --build
  ```

  Notes:
  - HTTPS is enforced at deployment layer (use a reverse proxy like Nginx / cloud provider) and the backend will redirect non-HTTPS requests in production.
  - Add `NODE_ENV=production`, `CORS_ORIGIN`, and `TRUST_PROXY=1` on your hosting platform.
  - I did not modify frontend files; if you want I can wire `PaymentModal.tsx` and `Chatbot.tsx` to call these backend endpoints.
  