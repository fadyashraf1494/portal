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