// src/config/db.js
const mongoose = require('mongoose');
const logger = require('./logger');
const env = require('./env');

const MONGO_OPTIONS = {
  dbName: env.MONGODB_DB_NAME,
  maxPoolSize: 10,          // max connections per Node instance
  minPoolSize: 2,           // keep 2 warm connections always
  serverSelectionTimeoutMS: 5000,  // fail fast if Mongo unreachable
  socketTimeoutMS: 45000,          // kill idle sockets after 45s
  connectTimeoutMS: 10000,                  // write concern for replica set
};

let isConnected = false;

const connectDB = async (retries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, MONGO_OPTIONS);
      isConnected = true;
      logger.info('MongoDB connected', {
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        poolSize: MONGO_OPTIONS.maxPoolSize,
      });

      // Monitor connection events
      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        logger.warn('MongoDB disconnected — attempting reconnect');
      });

      mongoose.connection.on('reconnected', () => {
        isConnected = true;
        logger.info('MongoDB reconnected');
      });

      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error', { error: err.message });
      });

      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed`, {
        error: err.message,
        retryIn: delay,
      });

      if (attempt === retries) {
        logger.error('MongoDB: all retry attempts exhausted. Exiting.');
        process.exit(1); // Let Docker restart the container
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 30000); // exponential backoff, cap at 30s
    }
  }
};

const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    logger.info('MongoDB disconnected gracefully');
  }
};

const isDBConnected = () => isConnected;

module.exports = { connectDB, disconnectDB, isDBConnected };