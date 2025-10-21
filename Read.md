# Transport Portal — Full config files

This document contains a ready-to-use self-hosted stack for an internal **Company Transportation Portal** (booking seats on company buses). It includes Docker, backend (Node + Express), frontend (Next.js/React), PostgreSQL schema and sample data, and NGINX reverse proxy config. Copy files into a repo and run `docker-compose up -d`.

---

## Repo layout

```
transport-portal/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── db.js
│       ├── routes/
│       │   ├── buses.js
│       │   ├── bookings.js
│       │   └── auth.js
│       └── sql/
│           └── schema.sql
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   └── src/
│       ├── pages/_app.js
│       ├── pages/index.js
│       ├── pages/bus/[id].js
│       ├── components/SeatMap.js
│       └── lib/api.js
└── README.md
```

---

> **Important**: replace `JWT_SECRET` and any example credentials in `.env` before production.

---

## `docker-compose.yml`

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: portal
n      POSTGRES_PASSWORD: portalpass
      POSTGRES_DB: transport
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/src/sql:/docker-entrypoint-initdb.d:ro
    networks:
      - portal-net

  backend:
    build: ./backend
    restart: on-failure
    env_file: ./backend/.env.example
    depends_on:
      - postgres
    ports:
      - '4000:4000'
    networks:
      - portal-net

  frontend:
    build: ./frontend
    restart: on-failure
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
    ports:
      - '3000:3000'
    depends_on:
      - backend
    networks:
      - portal-net

  nginx:
    image: nginx:stable-alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - '80:80'
    depends_on:
      - frontend
      - backend
    networks:
      - portal-net

volumes:
  pgdata:

networks:
  portal-net:
    driver: bridge
```

---

## Backend

### `backend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY . .
EXPOSE 4000
CMD ["node", "src/index.js"]
```

### `backend/package.json`

```json
{
  "name": "transport-backend",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.11.0",
    "uuid": "^9.0.0"
  }
}
```

### `backend/.env.example`

```
PORT=4000
DATABASE_URL=postgresql://portal:portalpass@postgres:5432/transport
JWT_SECRET=changeme_replace_with_secure_value
TOKEN_EXPIRY=7d
```

### `backend/src/db.js`

```js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
module.exports = { query: (text, params) => pool.query(text, params), pool };
```

### `backend/src/index.js`

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const buses = require('./routes/buses');
const bookings = require('./routes/bookings');
const auth = require('./routes/auth');

app.use('/api/auth', auth);
app.use('/api/buses', buses);
app.use('/api/bookings', bookings);

app.get('/', (req, res) => res.json({ok:true}));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log('Backend running on', port));
```

### `backend/src/routes/auth.js` (simple email-only auth for demo)

```js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/auth/login { email }
router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  // upsert user
  const r = await db.query(
    `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email`,
    [email]
  );
  const user = r.rows[0];
  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.TOKEN_EXPIRY || '7d' });
  res.json({ token, user });
});

module.exports = router;
```

### `backend/src/routes/buses.js`

```js
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/buses
router.get('/', async (req, res) => {
  const r = await db.query(`SELECT id, name, driver_name, capacity, route FROM buses ORDER BY id`);
  res.json(r.rows);
});

// GET /api/buses/:id/seats - returns seat layout and bookings
router.get('/:id/seats', async (req, res) => {
  const busId = req.params.id;
  const bus = await db.query('SELECT id, capacity FROM buses WHERE id=$1', [busId]);
  if (!bus.rowCount) return res.status(404).json({error:'not found'});
  const capacity = bus.rows[0].capacity;
  const bookings = await db.query('SELECT seat_number, user_id FROM bookings WHERE bus_id=$1', [busId]);
  res.json({ capacity, seats: bookings.rows });
});

module.exports = router;
```

### `backend/src/routes/bookings.js`

```js
const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({error:'no token'});
  const token = h.replace('Bearer ','');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); } catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// POST /api/bookings { bus_id, seat_number }
router.post('/', auth, async (req, res) => {
  const { bus_id, seat_number } = req.body;
  const user_id = req.user.sub;
  if (!bus_id || seat_number == null) return res.status(400).json({error:'bus_id and seat_number required'});

  // check bus capacity
  const b = await db.query('SELECT capacity FROM buses WHERE id=$1', [bus_id]);
  if (!b.rowCount) return res.status(404).json({error:'bus not found'});
  const cap = b.rows[0].capacity;
  if (seat_number < 1 || seat_number > cap) return res.status(400).json({error:'invalid seat number'});

  // check if seat taken
  const taken = await db.query('SELECT id FROM bookings WHERE bus_id=$1 AND seat_number=$2', [bus_id, seat_number]);
  if (taken.rowCount) return res.status(409).json({error:'seat_taken'});

  // insert booking
  const r = await db.query('INSERT INTO bookings (bus_id, user_id, seat_number, created_at) VALUES ($1,$2,$3,now()) RETURNING id', [bus_id, user_id, seat_number]);
  res.json({ id: r.rows[0].id });
});

module.exports = router;
```

### `backend/src/sql/schema.sql` (auto-run by Postgres container)

```sql
-- users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL
);

-- buses
CREATE TABLE IF NOT EXISTS buses (
  id serial PRIMARY KEY,
  name text NOT NULL,
  driver_name text,
  capacity integer NOT NULL,
  route text
);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id serial PRIMARY KEY,
  bus_id integer REFERENCES buses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  seat_number integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bus_id, seat_number)
);

-- sample data
INSERT INTO buses (name, driver_name, capacity, route) VALUES
('Bus A', 'Ahmed', 20, 'Site A ↔ HQ') ON CONFLICT DO NOTHING;
INSERT INTO buses (name, driver_name, capacity, route) VALUES
('Bus B', 'Mona', 15, 'Site B ↔ HQ') ON CONFLICT DO NOTHING;
```

> Note: `gen_random_uuid()` requires the `pgcrypto` extension; if unavailable, change to `uuid_generate_v4()` or use application to insert uuids. For simplicity, Postgres default can be adjusted.

---

## Frontend (Next.js)

### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### `frontend/package.json`

```json
{
  "name": "transport-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "swr": "^2.2.0",
    "axios": "^1.4.0"
  }
}
```

### `frontend/next.config.js`

```js
module.exports = {
  reactStrictMode: true,
}
```

### `frontend/src/lib/api.js`

```js
import axios from 'axios';
const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000' });
export default API;
```

### `frontend/src/components/SeatMap.js`

```jsx
import React from 'react';

export default function SeatMap({ capacity, seats, onSelect, selected }){
  const taken = new Set(seats.map(s=>s.seat_number));
  const cols = 4; // simple grid
  const rows = Math.ceil(capacity/cols);
  const arr=[];
  for(let r=0;r<rows;r++){
    const row=[];
    for(let c=0;c<cols;c++){
      const num = r*cols + c + 1;
      if(num>capacity) break;
      const isTaken = taken.has(num);
      row.push(
        <button key={num} disabled={isTaken} onClick={()=>onSelect(num)} style={{margin:6,padding:10,opacity:isTaken?0.5:1,background:selected===num?'#4caf50':'#eee'}}>
          {num}
        </button>
      )
    }
    arr.push(<div key={r} style={{display:'flex'}}>{row}</div>);
  }
  return <div>{arr}</div>;
}
```

### `frontend/src/pages/index.js`

```jsx
import useSWR from 'swr'
import API from '../lib/api'
import Link from 'next/link'

const fetcher = url => API.get(url).then(r=>r.data)

export default function Home(){
  const {data, error} = useSWR('/api/buses', fetcher)
  if (error) return <div>failed to load</div>
  if (!data) return <div>loading...</div>
  return (
    <div style={{padding:20}}>
      <h1>Company Buses</h1>
      <ul>
        {data.map(bus => (
          <li key={bus.id} style={{margin:10}}>
            <strong>{bus.name}</strong> — {bus.route} — Driver: {bus.driver_name} — Capacity: {bus.capacity}
            {' '}<Link href={`/bus/${bus.id}`}><a>Manage/Book</a></Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### `frontend/src/pages/bus/[id].js`

```jsx
import {useRouter} from 'next/router'
import useSWR from 'swr'
import API from '../../lib/api'
import SeatMap from '../../components/SeatMap'
import { useState } from 'react'

const fetcher = url => API.get(url).then(r=>r.data)

export default function Bus(){
  const router = useRouter();
  const { id } = router.query;
  const { data, mutate } = useSWR(id?`/api/buses/${id}/seats`:null, fetcher)
  const [selected, setSelected] = useState(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  async function book(){
    if(!selected) return alert('select seat');
    try{
      await API.post('/api/bookings', { bus_id: parseInt(id), seat_number: selected }, { headers: { Authorization: `Bearer ${token}` } })
      alert('booked')
      mutate()
    }catch(e){ alert(e.response?.data?.error || 'failed') }
  }

  if(!data) return <div>loading...</div>
  return (
    <div style={{padding:20}}>
      <h2>Bus {id}</h2>
      <SeatMap capacity={data.capacity} seats={data.seats} onSelect={setSelected} selected={selected} />
      <div style={{marginTop:20}}>
        <button onClick={book}>Book seat {selected || ''}</button>
      </div>
    </div>
  )
}
```

---

## NGINX

### `nginx/nginx.conf`

```nginx
worker_processes auto;
events { worker_connections 1024; }
http {
  sendfile on;
  upstream frontend { server frontend:3000; }
  upstream backend { server backend:4000; }

  server {
    listen 80;
    server_name _;

    location /api/ {
      proxy_pass http://backend/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
      proxy_pass http://frontend/;
      proxy_set_header Host $host;
    }
  }
}
```

---

## README.md (usage)

```md
# Transport Portal (self-hosted)

1. Copy repo to server.
2. Edit `backend/.env.example` -> create `.env` with secure JWT secret.
3. Build and run: `docker-compose up -d --build`
4. Postgres will initialise schema from `backend/src/sql/schema.sql`.
5. Open `http://SERVER_IP/` to access the portal frontend.

Development notes:
- To create test user, POST to `/api/auth/login` with `{ "email": "your.email@company.com" }` and save token to `localStorage.setItem('token', token)` in browser devtools.
```

---

## Final notes & next steps

* This is a working skeleton focused on seat booking constraints and showing when seats are taken.
* You should harden authentication (integrate LDAP/SSO) and add rate-limiting, input validation and proper migrations for production.
* If you'd like, I can now:

  * Provide a `systemd` unit and nginx TLS config (Let's Encrypt) for production.
  * Replace simple JWT auth with LDAP/Active Directory integration.
