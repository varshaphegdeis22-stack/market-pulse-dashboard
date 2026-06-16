# Market Pulse Dashboard

Market Pulse Dashboard is a full-stack stock market analytics platform built with modern web technologies.  
It provides real-time stock insights, market trends, and data visualization through an interactive dashboard.

## Features

* Real-time stock market data visualization
* Interactive charts and analytics
* Portfolio tracking
* Backend API integration
* PostgreSQL database support
* Responsive UI built with React
* Type-safe APIs with TypeScript

## Tech Stack

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* PostgreSQL
* Drizzle ORM



### Package Management

* pnpm (Monorepo workspace)



## Project Structure



artifacts/
├── api-server/       # Backend server
├── stockdash/        # Frontend application
├── db/               # Database schema \& config
├── api-zod/          # Shared API validation



## Installation

### 1\. Clone the repository


git clone https://github.com/yourusername/market-pulse-dashboard.git
cd market-pulse-dashboard


### 2\. Install dependencies


pnpm install


### 3\. Setup environment variables

Create `.env` inside `artifacts/api-server/`:

```env
DATABASE\_URL=postgresql://postgres:yourpassword@localhost:5432/marketpulse
PORT=5000
NODE\_ENV=development
```

### 4\. Setup database


pnpm --filter @workspace/db run push


### 5\. Run backend

```bash
pnpm --filter @workspace/api-server run dev
```

### 6\. Run frontend


pnpm --filter @workspace/stockdash run dev




## Running the App

Frontend:
http://localhost:5173

Backend:
http://localhost:5000



## 

