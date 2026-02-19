const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const sanitize = require('./middleware/sanitize');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/microjobs';

app.use(cors());
app.use(express.json());
app.use(cookieParser());
// Sanitize incoming requests to mitigate NoSQL injection payloads
app.use(sanitize);

app.get('/', (req, res) => {
  res.send('Backend server is running');
});

app.use('/api/auth', authRoutes);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Accessible at: http://localhost:${PORT}`);
      console.log(`Android emulator can reach: http://10.0.2.2:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  });