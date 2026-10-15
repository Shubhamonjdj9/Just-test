import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { releaseExpiredReservations } from "./routes/payments.js";

try {
  await connectDatabase(config.mongoUri);
  const app = createApp();
  const reservationTimer = setInterval(() => {
    releaseExpiredReservations().catch((error) => {
      console.error("Expired payment reservations could not be released:", error.message);
    });
  }, 60_000);
  reservationTimer.unref();
  const host = config.nodeEnv === "production" ? "0.0.0.0" : "127.0.0.1";
  const server = app.listen(config.port, host, () => {
    console.info(`Atelier API listening at http://localhost:${config.port}/api/v1`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      clearInterval(reservationTimer);
      server.close(async () => {
        const mongoose = await import("mongoose");
        await mongoose.default.disconnect();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error("Atelier API could not start:", error.message);
  process.exitCode = 1;
}
