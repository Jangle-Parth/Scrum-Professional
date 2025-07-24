const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(
            process.env.MONGODB_URI ||
            'mongodb+srv://atplparth:QKFzGqweq0tSepZd@cluster0.8s5tixz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
        );

        console.log(`📄 MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

module.exports = connectDB;