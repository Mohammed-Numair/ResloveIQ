import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
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
