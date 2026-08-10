import Category from '../models/Category.js';
import Job from '../models/Job.js';

export async function getCategoryList(req, res) {
    try {
        const categories = await Category.find({}).sort({ order: 1, name: 1 });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({message: "Failed to get categories."});
    }
}

export async function createCategory(req, res) {
    try {
        const name = String(req.body?.name || '').trim();
        if(!name) {
            return res.status(400).json({message: "Category name is required."});
        }
        const ifExists = await Category.findOne({name}).collation({ locale: 'en', strength: 2 });
        if(ifExists) {
            return res.status(409).json({message: "Category already exists."});
        }

        const category = new Category({name});
        await category.save();
        res.status(201).json({message: "Category created successfully.", category});

    } catch (error) {
        res.status(500).json({message: "Failed to make category."});
    }
}

export async function deleteCategory(req, res){
    try {
        const {id} = req.params;
        const category = await Category.findById(id);
        if(!category) {
            return res.status(404).json({message: "Category not found."});
        }
        const jobsUsingCategory = await Job.countDocuments({ category: id });
        if (jobsUsingCategory > 0) {
            return res.status(409).json({
                message: "Category is used by existing jobs and cannot be deleted.",
            });
        }
        await category.deleteOne();
        res.status(200).json({message: "Category deleted successfully."});
    } catch (error) {
        res.status(500).json({message: "Failed to delete category."});
    }
}

export async function editCategory(req, res){
    try {
        const {id} = req.params;
        const name = String(req.body?.name || '').trim();
        if(!name) {
            return res.status(400).json({message: "Category name is required."});
        }
        const ifExists = await Category.findOne({ _id: { $ne: id }, name })
            .collation({ locale: 'en', strength: 2 });
        if(ifExists) {
            return res.status(409).json({message: "Category already exists."});
        }
        const category = await Category.findByIdAndUpdate(id, {name}, { returnDocument: 'after' });
        if(!category) {
            return res.status(404).json({message: "Category not found."});
        }
        res.status(200).json({message: "Category updated successfully.", category});
    } catch (error) {
        res.status(500).json({message: "Failed to edit category."});
    }
}
