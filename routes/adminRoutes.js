const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { productUpload, categoryUpload } = require('../helpers/multer');
const productController = require('../controllers/productCtrl');
const categoryController = require('../controllers/categoryCtrl');
const couponController = require('../controllers/couponCtrl.js');
const salesCtrl = require('../controllers/salesCtrl.js');
const offerCtrl = require('../controllers/offerCtrl.js');


// Admin routes
router.get(['/', '/login'], adminController.getLoginPage);
router.post('/auth/login', adminController.loginUser);


router.get('/dashboard', adminController.getHomePage);
router.get('/auths/logout', adminController.logoutUser);
router.get('/userm', adminController.getAllUsers);
router.post('/block-user/:id', adminController.blockUser);
router.post('/unblock-user/:id', adminController.unblockUser);

router.get('/order-analysis',adminController.ChartCtrl);


// Category Routes
router.get('/categories', categoryController.getCategories);
router.get('/categories/add', categoryController.getAddCategoryPage);
router.post('/categories/add', categoryUpload.single('image'), categoryController.addCategory);
router.get('/categories/edit/:id', categoryController.getEditCategoryPage);
router.post('/categories/edit/:id', categoryUpload.single('image'), categoryController.updateCategory);
router.post('/categories/toggle/:id', categoryController.toggleCategoryStatus); 


// Product Management Routes

router.get('/products', productController.getProducts);
router.get('/products/add', productController.getAddProductPage);
router.post('/products/add', productUpload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImages', maxCount: 3 }
]), productController.addProduct);
router.get('/products/edit/:id', productController.getEditProductPage);
router.post('/products/edit/:id', productUpload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImages', maxCount: 3 }
]), productController.updateProduct);
router.delete('/products/delete/:id', productController.deleteProduct); // Change to DELETE method
router.post('/products/toggle-status/:id', productController.toggleProductStatus)
router.get('/products/manage-stock/:id', productController.getManageStockPage);
router.post('/products/update-stock/:id', productController.updateStock);

// Orders Management
router.get('/orders', productController.getOrderList);
router.get('/orders-a/:id', productController.getOrderDetails);
router.put('/order/status/:id', productController.updateOrderStatus);

// Return Management
router.get('/returns',productController.getReturnList);
router.put('/return/status/:id', productController.updateReturnStatus);

//salesReport

router.get('/salesreport', salesCtrl.getSalesReportPage);
router.get('/salesreport/generate', salesCtrl.generateSalesReport);
router.post('/salesreport/download', salesCtrl.downloadSalesReport);

// List coupons
router.get('/coupons', couponController.listCoupons);
router.get('/coupon/add', couponController.showAddCouponForm);
router.post('/coupon/add', couponController.addCoupon);
router.get('/coupon/edit/:id', couponController.showEditCouponForm);
router.post('/coupon/edit/:id', couponController.editCoupon);
router.get('/coupon/list/:id', couponController.listCoupon);
router.get('/coupon/unlist/:id', couponController.unlistCoupon);


// Category Offer
router.get('/category/offers', offerCtrl.gotoCategoryOffer);
router.post('/category/offers/add-edit', offerCtrl.addOrEditOffer);
router.post('/category/offers/activate', offerCtrl.activateOffer);

// Product Offer
router.get('/product/offers', offerCtrl.gotoProductOffer);
router.post('/product/offers/add-edit', offerCtrl.ProductaddOrEditOffer);
router.post('/product/offers/activate', offerCtrl.ProductactivateOffer);

module.exports = router;
