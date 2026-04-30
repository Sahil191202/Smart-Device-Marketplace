// src/config/redis.js
const { createClient } = require('redis');
const logger = require('./logger');
const env = require('./env');

const REDIS_URL = env.REDIS_URL

const createRedisClient = (role = 'default') => {
  const client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error(`Redis [${role}]: max reconnect attempts reached`);
          return new Error('Redis: max reconnect attempts');
        }
        const delay = Math.min(retries * 100, 3000); // up to 3s between retries
        logger.warn(`Redis [${role}]: reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
      connectTimeout: 10000,
    },
  });

  client.on('connect', () => logger.info(`Redis [${role}]: connected`));
  client.on('ready', () => logger.info(`Redis [${role}]: ready`));
  client.on('error', (err) => logger.error(`Redis [${role}]: error`, { error: err.message }));
  client.on('reconnecting', () => logger.warn(`Redis [${role}]: reconnecting...`));
  client.on('end', () => logger.warn(`Redis [${role}]: connection closed`));

  return client;
};

// Separate clients for different roles:
// - redisClient: general cache, sessions, rate limiting
// - redisPub/redisSub: Socket.io pub/sub (must be dedicated connections)
// Bull creates its own connections internally
let redisClient = null;
let redisPub = null;
let redisSub = null;

const connectRedis = async () => {
  redisClient = createRedisClient('cache');
  redisPub = createRedisClient('pub');
  redisSub = createRedisClient('sub');

  await Promise.all([
    redisClient.connect(),
    redisPub.connect(),
    redisSub.connect(),
  ]);

  logger.info('All Redis clients connected');
};

const disconnectRedis = async () => {
  await Promise.all([
    redisClient?.quit(),
    redisPub?.quit(),
    redisSub?.quit(),
  ]);
  logger.info('All Redis clients disconnected');
};

// Getters — throw if accessed before connectRedis() is called
const getRedisClient = () => {
  if (!redisClient) throw new Error('Redis not initialized. Call connectRedis() first.');
  return redisClient;
};

const getRedisPub = () => {
  if (!redisPub) throw new Error('Redis pub not initialized.');
  return redisPub;
};

const getRedisSub = () => {
  if (!redisSub) throw new Error('Redis sub not initialized.');
  return redisSub;
};

// Bull queue connection options (Bull uses ioredis connection spec)
const getBullRedisOptions = () => ({
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // required by Bull
    enableReadyCheck: false,    // required by Bull
  },
});

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  getRedisPub,
  getRedisSub,
  getBullRedisOptions,
};