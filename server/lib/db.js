import mongoose from 'mongoose';

let inMemoryMongoServer = null;

export const connectDB = async ({ mongoUri, dbName, isProduction, allowInMemoryMongo }) => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }
    if (mongoose.connection.readyState === 2) {
        await mongoose.connection.asPromise();
        return mongoose.connection;
    }

    if (mongoUri) {
        try {
            await mongoose.connect(mongoUri, {
                dbName,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
            });
            console.log('Connected to DB');
            return mongoose.connection;
        } catch (dbError) {
            if (isProduction || !allowInMemoryMongo) {
                throw dbError;
            }
            console.warn(
                `Primary MongoDB connection failed (${dbError?.message || 'unknown error'}). Falling back to in-memory MongoDB for local development.`
            );
        }
    } else if (isProduction || !allowInMemoryMongo) {
        throw new Error('MONGO_URI is not defined');
    }

    if (mongoose.connection.readyState !== 1) {
        // A standalone MongoMemoryServer can't run transactions, and every
        // write path that matters for a demo (offers, hire, settlement,
        // top-up) uses mongoose.startSession()/withTransaction -- those
        // would 500 against a standalone instance. A single-node replica
        // set supports transactions and is the same pattern already used in
        // server/tests/controllers/applicationSettlement.test.js.
        const { MongoMemoryReplSet } = await import('mongodb-memory-server');
        inMemoryMongoServer = await MongoMemoryReplSet.create({
            replSet: { count: 1 },
        });
        const inMemoryUri = inMemoryMongoServer.getUri();
        await mongoose.connect(inMemoryUri, { dbName });
        console.warn(`Connected to in-memory MongoDB replica set (${dbName})`);
    }
};

export const closeDB = async () => {
    await mongoose.connection.close();
    if (inMemoryMongoServer) {
        await inMemoryMongoServer.stop();
    }
};
