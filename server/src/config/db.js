import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Production connection lifecycle listeners
    mongoose.connection.on('error', (err) => {
      console.error(`⚠️ MongoDB Runtime Error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully.');
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    if (error.message.includes('whitelist') || error.message.includes('SSL alert') || error.message.includes('ReplicaSetNoPrimary')) {
      console.error('👉 Cause: Your current IP address is not whitelisted in MongoDB Atlas.');
      console.error('👉 Fix: Go to cloud.mongodb.com -> Network Access -> Add IP Address -> Select "Allow Access from Anywhere" (0.0.0.0/0).');
    }
  }
};

export default connectDB;
