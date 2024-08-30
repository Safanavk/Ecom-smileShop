const express = require('express');
const router = express.Router();
const passport = require('../config/passport-config');
const userCtrl = require('../controllers/userCtrl')
const usersideCtrl = require('../controllers/usersideCtrl');
const referralController = require('../controllers/referalCtrl');
const addressCtrl = require('../controllers/addressCtrl'); 
const orderCtrl = require('../controllers/orderCtrl');
const returnController = require('../controllers/returnCtrl');
const wishlistCtrl = require('../controllers/wishlistCtrl');
const paymentCtrl = require('../controllers/paymentCtrl');
const multer = require('multer');
const upload = multer();
const { checkProductExists } = require('../middlewares/auth'); 


router.get('/pagenotfound',userCtrl.pageNotFound);
// Define your user routes here
router.get('/',userCtrl.getHomePage);
router.get('/login',userCtrl.getLoginPage);
router.get('/signup',userCtrl.getSignupPage);
router.post('/signup',userCtrl.newUserRegistration);
router.post('/auth/verify-otp', userCtrl.verifyOtp);
router.post('/auth/resend', userCtrl.resendOtp);
router.post('/auth/login', userCtrl.loginUser);
router.get('/auth/logout', userCtrl.logoutUser);



// Google OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    req.session.user = req.user; // Ensure user is set in session
    res.redirect('/');
});

// Product Page
router.get('/products', usersideCtrl.getProducts);
router.get('/products/:id', checkProductExists ,usersideCtrl.getProductDetails); // Apply middleware here


// Forgot Password
router.get('/forgot-pass', userCtrl.getForgotPasswordPage);
router.post('/auth/forgot-pass', userCtrl.handleForgotPassword);
router.get('/reset', userCtrl.handleResetPasswordPageAndRequest);
router.post('/auth/reset', userCtrl.handleResetPasswordPageAndRequest);

// Referrals
router.get('/referrals', referralController.getUserReferrals);

//profile

router.get('/profile', userCtrl.profile)
router.post('/profile/update', userCtrl.updateProfile);
router.post('/profile/change-password', userCtrl.changePassword);
router.get('/address', addressCtrl.getAddresses);
router.post('/address', addressCtrl.addAddress);
router.delete('/address/:id', addressCtrl.deleteAddress);
router.get('/address/edit/:id',addressCtrl.getEditAddress); // Fetch address to edit
router.post('/address/edit/:id', addressCtrl.updateAddress);

//wishlist

router.get('/wishlist', wishlistCtrl.getWishlistPage);
router.post('/wishlist/add', wishlistCtrl.addToWishlist);
router.post('/wishlist/remove', wishlistCtrl.removeFromWishlist);

// Cart Routes
router.get('/cart/data', userCtrl.getCart);
router.post('/check-cart',userCtrl.checkCart);
router.post('/cart/add',userCtrl.addToCart);
router.post('/cart/remove/:id', userCtrl.removeFromCart);
router.post('/cart/update/:productId', userCtrl.updateCartQuantity);
router.get('/api/product/:productId/variant/:size',userCtrl.getProductVariant);
router.post('/api/cart/check-stock',userCtrl.quantityCheck);

// Order Management
router.get('/checkout', orderCtrl.checkout);
router.post('/order', orderCtrl.createOrder);
router.post('/api/apply-coupon', orderCtrl.applyCoupon);
router.post('/api/remove-coupon', orderCtrl.removeCoupon);
router.get('/confirm', orderCtrl.orderConfirm);
router.get('/get/orders', orderCtrl.getUserOrders);
router.get('/orders/:id', orderCtrl.getOrderDetails);
router.get('/orders/:id/invoice', orderCtrl.downloadInvoice);
router.post('/orders/:id/cancel', orderCtrl.cancelOrder);

// New Routes for Razorpay Integration
router.post('/api/create-order', orderCtrl.createRazorpayOrder);
router.post('/confirm-razorpay-payment', orderCtrl.confirmRazorpayPayment);
router.post('/api/verify-payment', orderCtrl.verifyRazorpayPayment);

// Return Management (Use only returnController)
router.get('/orders/:orderId/return', returnController.showReturnForm); // Move to returnController
router.get('/returns', returnController.getUserReturnRequests);
router.post('/returns', upload.none(), returnController.createReturnRequest);

// Payment Routes
router.get('/wallet', paymentCtrl.getWallet);
router.get('/wallet/add-money', paymentCtrl.addMoneyForm);
router.post('/add-money', paymentCtrl.initiatePayment);
router.post('/verify-payment', paymentCtrl.verifyPayment);


module.exports = router;
