import { MongoClient, Db } from "mongodb";

const DB_NAME = "subastas_boe";

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no definida en variables de entorno");

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const c = await getClientPromise();
  return c.db(DB_NAME);
}

export async function getSubastasCollection() {
  const db = await getDb();
  return db.collection("subastas");
}

export async function getAnalysisCollection() {
  const db = await getDb();
  return db.collection("analysis");
}

export async function getDocumentsCollection() {
  const db = await getDb();
  return db.collection("documents");
}

export default getClientPromise;
