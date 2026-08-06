import mongoose from 'mongoose';

let inMemoryMongoServer = null;

export const connectDB = async ({ mongoUri, dbName, isProduction, allowInMemoryMongo }) => {
    if (mongoUri) {
        try {
            await mongoose.connect(mongoUri, {
                dbName,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            console.log('Connected to DB');
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
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        inMemoryMongoServer = await MongoMemoryServer.create({
            instance: { dbName },
        });
        const inMemoryUri = inMemoryMongoServer.getUri();
        await mongoose.connect(inMemoryUri, { dbName });
        console.warn(`Connected to in-memory MongoDB (${dbName})`);
    }
};

export const closeDB = async () => {
    await mongoose.connection.close();
    if (inMemoryMongoServer) {
        await inMemoryMongoServer.stop();
    }
};
