const Product = require('../model/productSchema');
const Category = require('../model/categorySchema');
require('dotenv').config();


const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const category = req.query.category;
        const sort = req.query.sort;
        const productType = req.query.productType;
        const searchQuery = req.query.search;

        const filter = { status: true };

        if (searchQuery) {
            filter.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (category) {
            filter.category = category;
        }

        let sortOption = {};
        if (sort === 'priceLow') {
            sortOption = { price: 1 };
        } else if (sort === 'priceHigh') {
            sortOption = { price: -1 };
        } else if (sort === 'nameAsc') {
            sortOption = { name: 1 };
        } else if (sort === 'nameDesc') {
            sortOption = { name: -1 };
        }

        const today = new Date();
        if (productType === 'new') {
            const tenDaysAgo = new Date(today);
            tenDaysAgo.setDate(today.getDate() - 10);
            filter.createdAt = { $gte: tenDaysAgo };
        } else if (productType === 'old') {
            const tenDaysAgo = new Date(today);
            tenDaysAgo.setDate(today.getDate() - 10);
            filter.createdAt = { $lt: tenDaysAgo };
        }

        const [categories, totalProducts, products] = await Promise.all([
            Category.find(),
            Product.countDocuments(filter),
            Product.find(filter)
                .populate('category')
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        const productsWithOffers = products.map(product => {
            // Check if the offer is active and calculate effective offer accordingly
            const categoryOffer = product.category.offerIsActive ? product.category.offerRate : 0;
            const productOffer = product.offerStatus ? product.discount : 0;
            const effectiveOffer = Math.max(categoryOffer, productOffer);
            const effectivePrice = product.price - (product.price * (effectiveOffer / 100));
        
            return {
                ...product.toObject(),
                effectiveOffer,
                effectivePrice
            };
        });
        

        res.render('user/products', {
            title: "Products",
            products: productsWithOffers,
            categories,
            currentPage: page,
            totalPages,
            admin: req.session.admin,
            category,
            sort,
            productType,
            searchQuery
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};



const getProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.status(404).send("Product not found");
        }

        // Calculate the effective price and offer if a discount is available

        // Check if the offer is active and calculate effective offer accordingly
        const categoryOffer = product.category.offerIsActive ? product.category.offerRate : 0;
        const productOffer = product.offerStatus ? product.discount : 0;
        const effectiveOffer = Math.max(categoryOffer, productOffer);
        const effectivePrice = product.price - (product.price * (effectiveOffer / 100));

        // Add the effective price and offer to the product object
        const productWithOffer = {
            ...product.toObject(),
            effectiveOffer,
            effectivePrice
        };

        // Check available sizes
        let availableSizes = product.variants.filter(variant => variant.stock > 0);
        productWithOffer.displayStatus = availableSizes.length === 0 ? 'Out of stock' : 'Available';

        // Fetch related products from the same category
        let relatedProducts = await Product.find({
            status: true,
            category: product.category._id,
            _id: { $ne: product._id }
        }).limit(4);

        // If no related products in the same category, fetch any other active products
        if (relatedProducts.length === 0) {
            relatedProducts = await Product.find({
                status: true,
                _id: { $ne: product._id }
            }).limit(4);
        }

        // Render the product details page with the fetched data
        res.render('user/productDetails', {
            product: productWithOffer,
            relatedProducts,
            admin: req.session.admin,
            title: "Product Details"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};





module.exports = {
    getProducts,
    getProductDetails
}