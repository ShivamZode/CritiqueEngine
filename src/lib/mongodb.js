// src/lib/mongodb.js
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, 
      family: 4, // This forces Node.js to use IPv4, bypassing the ISP routing bug!
      
      // 🛡️ THE CONNECTION EXHAUSTION SHIELDS 🛡️
      maxPoolSize: 10, // Max 10 connections per serverless function (Default is 100!)
      minPoolSize: 1,  // Keep at least 1 connection warm per active function
      maxIdleTimeMS: 10000, // Brutally kill connections after 10 seconds of inactivity
      waitQueueTimeoutMS: 5000,
    };

    // 👉 THE NEW SHIELD: Disable admin tasks in production
    if (process.env.NODE_ENV === 'production') {
      mongoose.set('autoIndex', false);
      mongoose.set('autoCreate', false);
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("🗄️ Successfully connected to MongoDB!");
      return mongoose;
    });
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}