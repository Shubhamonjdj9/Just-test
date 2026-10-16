import { connectDatabase } from "../../server/src/config/database.js";
import { config } from "../../server/src/config/env.js";
import { releaseExpiredReservations } from "../../server/src/routes/payments.js";

export default async function releaseReservations() {
  try {
    await connectDatabase(config.mongoUri);
    const released = await releaseExpiredReservations();
    console.info(`Released inventory for ${released} expired orders.`);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Scheduled inventory release failed:", error);
    throw error;
  }
}
