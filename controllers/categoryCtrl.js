const Category = require('../model/categorySchema');
const Product = require('../model/productSchema');

// Get All categories
const getCategories = async (req, res) => {
    try {
        if (req.session.admin) {
            const categories = await Category.find();
            res.render('admin/categories', { title: "Category List", categories, layout: 'adminlayout' });
        } else {
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Add category page
const getAddCategoryPage = (req, res) => {
    res.render('admin/addCategory', { title: "Add Category", layout: 'adminlayout' });
};

// Add a new category
const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const image = req.file.filename;

        const normalizedName = name.trim().toLowerCase();

        // Check if a category with the same normalized name exists
        const existingCategory = await Category.findOne({ nameLower: normalizedName });
        if (existingCategory) {
            return res.render('admin/addCategory', {
                title: 'Add Category',
                errorMessage: 'Category Name already exists. Please choose another name',
                layout: 'adminlayout'
            });
        }

        const newCategory = new Category({
            name,
            description,
            image,
            nameLower: normalizedName
        });
        await newCategory.save();

        req.flash('success_msg', 'Category added successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error adding category');
        res.redirect('/admin/categories');
    }
};

// Edit category page
const getEditCategoryPage = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        res.render('admin/editCategory', { title: "Edit Category", category, layout: 'adminlayout' });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// Update an existing category
const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const image = req.file ? req.file.filename : req.body.existingImage;
        const normalizedName = name.trim().toLowerCase();

        // Check if another category with the same normalized name exists
        const existingCategory = await Category.findOne({ nameLower: normalizedName, _id: { $ne: req.params.id } });
        if (existingCategory) {
            return res.render('admin/editCategory', {
                title: 'Edit Category',
                category: await Category.findById(req.params.id),
                errorMessage: 'Category Name already exists. Please choose another name',
                layout: 'adminlayout'
            });
        }

        await Category.findByIdAndUpdate(req.params.id, {
            name,
            description,
            image,
            nameLower: normalizedName
        });

        req.flash('success_msg', 'Category updated successfully');
        res.redirect('/admin/categories');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error updating category');
        res.redirect('/admin/categories');
    }
};


// Soft delete (list/unlist) a category
const toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const newStatus = category.status === 'active' ? 'inactive' : 'active';
        category.status = newStatus;
        if (!category.nameLower) {
            category.nameLower = category.name.toLowerCase();
        }
        await category.save();

        // Update the status of all products under this category
        await Product.updateMany({ category: category._id }, { status: newStatus === 'active' });

        res.json({ success: true, message: `Category ${newStatus === 'active' ? 'listed' : 'unlisted'} successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating category status' });
    }
};


 


module.exports = {
    getCategories,
    getAddCategoryPage,
    addCategory,
    getEditCategoryPage,
    updateCategory,
    toggleCategoryStatus
};