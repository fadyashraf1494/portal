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


