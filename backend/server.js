require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const loanRoutes = require('./routes/loans');
const faceRoutes = require('./routes/face');
const analyticsRoutes = require('./routes/analytics');
const walletRoutes = require('./routes/wallet');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ruralconnect';
mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 5000,
}).then(() => {
  console.log('✅ Connected to MongoDB successfully!');
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  console.log('⚠️  Server will continue to run without database connection');
});

const db = mongoose.connection;
db.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});
db.on('connected', () => {
  console.log('🔗 MongoDB connection established');
});
db.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected');
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5000', 'http://192.168.29.142:5000'],
  credentials: true,
}));
app.use(bodyParser.json({ limit: '50mb' }));  
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/face', faceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Backend server is running' });
});

// Clear database endpoint (for development only)
app.post('/api/clear-db', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      await db.collection(collection.name).drop();
      console.log(`🗑️  Dropped collection: ${collection.name}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Database cleared successfully',
      droppedCollections: collections.map(c => c.name)
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear database' 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
