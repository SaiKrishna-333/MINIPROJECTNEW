const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');

async function run() {
	try {
		const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ruralconnect';
		await mongoose.connect(mongoUri);
		console.log('Connected to', mongoUri);
		const res = await User.deleteMany({});
		console.log('Deleted users:', res.deletedCount);
	} catch (err) {
		console.error('Error:', err.message);
	} finally {
		await mongoose.connection.close();
		process.exit(0);
	}
}

run();
