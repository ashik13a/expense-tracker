import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const startServer = async () => {
  await connectDB();
  const app = createApp();

  app.listen(env.port, () => {
    console.info(`Expense Tracker API listening on http://localhost:${env.port}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
