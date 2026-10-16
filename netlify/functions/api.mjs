import serverless from "serverless-http";
import { connectDatabase } from "../../server/src/config/database.js";
import { config } from "../../server/src/config/env.js";
import { createApp } from "../../server/src/app.js";

const appHandler = serverless(createApp(), { basePath: "/.netlify/functions/api" });

export async function handler(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    await connectDatabase(config.mongoUri);
    return await appHandler(event, context);
  } catch (error) {
    console.error("Netlify API request failed:", error);
    throw error;
  }
}
