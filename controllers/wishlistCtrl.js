const User = require('../model/userSchema');
const Product = require('../model/productSchema');
const Wishlist = require('../model/wishlistSchema');

const addToWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: 'User not logged in' });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        // Ensure the productId is valid
        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(400).json({ success: false, message: 'Product does not exist' });
        }

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [productId] });
        } else {
            wishlist.products.addToSet(productId);
        }

        await wishlist.save();

        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.json({ success: false, message: 'User not logged in' });
        }

        const userId = req.session.user._id;
        const { productId } = req.body;

        // Ensure the productId is valid
        const productExists = await Product.findById(productId);
        if (!productExists) {
            return res.status(400).json({ success: false, message: 'Product does not exist' });
        }

        const wishlist = await Wishlist.findOne({ user: userId });
        if (wishlist) {
            wishlist.products.pull(productId);
            await wishlist.save();
        }

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



// Get wishlist page
const getWishlistPage = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
        const skip = (page - 1) * limit;

        const wishlist = await Wishlist.findOne({ user: userId }).populate({
            path: 'products',
            options: {
                sort: { createdAt: -1 }, // Sort products by date
                skip,
                limit
            }
        });

        const totalWishlistItems = wishlist ? wishlist.products.length : 0;
        const totalPages = Math.ceil(totalWishlistItems / limit);

        res.render('user/wishlist', {
            title: 'My Wishlist',
            wishlist: wishlist ? wishlist.products : [],
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


module.exports = { addToWishlist, removeFromWishlist, getWishlistPage };