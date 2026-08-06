import Category from '../models/Category.js';

export async function getCategoryList(req, res) {
    try {
        const categories = await Category.find({});
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({message: "Failed to get categories."});
    }
}

export async function createCategory(req, res) {
    try {
        const {name} = req.body;
        if(!name) {
            return res.status(400).json({message: "Category name is required."});
        }
        const ifExists = await Category.findOne({name});
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
        const category = await Category.findByIdAndDelete(id);
        if(!category) {
            return res.status(404).json({message: "Category not found."});
        }
        res.status(200).json({message: "Category deleted successfully."});
    } catch (error) {
        res.status(500).json({message: "Failed to delete category."});
    }
}

export async function editCategory(req, res){
    try {
        const {id} = req.params;
        const {name} = req.body;
        if(!name) {
            return res.status(400).json({message: "Category name is required."});
        }
        const ifExists = await Category.findOne({name});
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
