const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  for (const key of ['MONGO_URI', 'JWT_SECRET']) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }
  await connectDB();
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
})().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
