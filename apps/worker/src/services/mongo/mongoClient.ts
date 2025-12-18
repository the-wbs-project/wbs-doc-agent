import { MongoClient } from "mongodb";

export async function getMongoClient(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}
