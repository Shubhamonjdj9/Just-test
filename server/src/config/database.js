import mongoose from "mongoose";

let connectionPromise;

export async function connectDatabase(uri) {
  mongoose.set("strictQuery", true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
    }).finally(() => {
      connectionPromise = undefined;
    });
  }
  return connectionPromise;
}
