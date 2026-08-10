import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            unique: true,
            required: true,
            trim: true,
        },
        order: {
            type: Number,
            default: 999,
        },
    }
)

export default mongoose.model('Category', CategorySchema);
