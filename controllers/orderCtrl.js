
const Cart = require('../model/cartSchema');
const User = require('../model/userSchema');
const Address = require('../model/addressSchema');
const Order = require('../model/orderSchema');
const Product = require('../model/productSchema');
const Coupon = require('../model/couponSchema');
const Wallet = require('../model/walletSchema');
const Transaction = require('../model/transactionSchema');
const Razorpay = require('razorpay');

// Create a new order
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const checkout = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        const addresses = await Address.find({ userId: userId });
        const razorKeyId = process.env.RAZORPAY_KEY_ID;

        if (!cart) {
            return res.redirect('/cart'); // Redirect to cart if it's empty
        }

        let totalPrice = cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        let couponDetails = null;

        // Check if there's a coupon applied in the session
        if (req.session.coupon) {
            couponDetails = req.session.coupon;
            totalPrice = couponDetails.newTotal;
        }

        // Check the quantity of each product in the cart
        for (const item of cart.items) {
            if (item.quantity > item.product.stock) {
                return res.status(404).json({
                    success: false,
                    message: `Product ${item.product.name} quantity is not available`
                });
            }
        }

        const coupons = await Coupon.find();
        const user = await User.findById(userId);

        res.render('user/checkout', {
            title: "Checkout",
            cart,
            razorKeyId,
            addresses,
            totalPrice: totalPrice.toFixed(2),
            couponDetails, // Pass coupon details to the frontend
            user,
            coupons
        });
    } catch (error) {
        console.error('Error rendering checkout page:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};





// Create Order (modified to handle different payment methods)
const createOrder = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethod,couponCode  } = req.body;

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

         // Check the quantity of each product in the cart
        
        for (const item of cart.items) {
            if (item.quantity > item.product.stock) {
                return res.status(404).json({
                    success: false,
                    message: `Product ${item.product.name} quantity is not available`
                });
            }
        }

        let address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            size: item.size,
            quantity: item.quantity,
            price: item.product.price
        }));

        let totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discountAmount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon && coupon.status === 'Active') {
                discountAmount = Math.min(coupon.discountRate / 100 * totalAmount, coupon.maxDiscount);
                totalAmount -= discountAmount;
                coupon.usedBy += 1;
                await coupon.save();
            } else {
                return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
            }
        }

        let paymentStatus = 'Pending';

        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount,
            addressSnapshot: {
                houseNumber: address.houseNumber,
                street: address.street,
                city: address.city,
                zipcode: address.zipcode,
                country: address.country,
            },
            paymentMethod,
            paymentStatus,
            discountAmount,
            orderStatus: 'Pending',
        });

        await order.save();

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            const variant = product.variants.find(v => v.size === item.size);
            if (variant) {
                variant.stock -= item.quantity;
            }
            await product.save();
        }

        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Order creation error:', error);
        return res.status(500).json({ success: false, message: 'An error occurred while creating the order' });
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethod, couponCode } = req.body;

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        let address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            size: item.size,
            quantity: item.quantity,
            price: item.product.price
        }));

        let totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let discountAmount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ code: couponCode });
            if (coupon && coupon.status === 'Active') {
                discountAmount = Math.min(coupon.discountRate / 100 * totalAmount, coupon.maxDiscount);
                totalAmount -= discountAmount;
                coupon.usedBy += 1;
                await coupon.save();
            } else {
                return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
            }
        }

        const options = {
            amount: totalAmount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: `order_rcptid_${userId}`
        };

        const razorpayOrder = await razorpayInstance.orders.create(options);

        if (!razorpayOrder) {
            return res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
        }

        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount,
            discountAmount,
            addressSnapshot: {
                houseNumber: address.houseNumber,
                street: address.street,
                city: address.city,
                zipcode: address.zipcode,
                country: address.country,
            },
            paymentMethod,
            paymentStatus: 'Pending',
            orderStatus: 'Pending',
            razorpayOrderId: razorpayOrder.id,
            coupon: couponCode ? { code: couponCode, discountAmount } : undefined
        });

        await order.save();
        console.log(order.razorpayOrderId + "The id generated")


        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            totalAmount,
            user: req.session.user,
            address
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


// Adding logs to confirmRazorpayPayment
const confirmRazorpayPayment = async (req, res) => {
    try {
        console.log('confirmRazorpayPayment called'); // Debug log
        const userId = req.session.user._id;
        const { razorpayPaymentId, razorpayOrderId } = req.body;

        const order = await Order.findOne({ razorpayOrderId });
        if (!order) {
            console.log('Order not found'); // Debug log
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Only update order status if payment is verified successfully
        order.paymentStatus = 'Paid';
        order.razorpayPaymentId = razorpayPaymentId;
        order.orderStatus = 'Pending';
        await order.save();

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart) {
            console.log('Cart not found'); // Debug log
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            const variant = product.variants.find(v => v.size === item.size);
            if (variant) {
                variant.stock -= item.quantity;
            }
            await product.save();
        }

        // Clear the cart
        cart.items = [];
        cart.totalPrice = 0;
        await cart.save();
        console.log('Cart cleared and saved'); // Debug log

        const user = await User.findById(userId);
        if (user.isEligibleForReferralReward) {
            const newUserWallet = await Wallet.findOne({ userId });
            const rewardAmount = 150; // Rs. 150 for the new user upon first order
            newUserWallet.balance += rewardAmount;
            const transaction = new Transaction({
                userId,
                amount: rewardAmount,
                description: 'First order referral reward',
                type: 'credit',
            });
            await transaction.save();
            newUserWallet.transactions.push(transaction._id);
            await newUserWallet.save();

            user.isEligibleForReferralReward = false;
            await user.save();
        }

        res.status(200).json({ success: true, message: 'Payment confirmed and order completed' });
    } catch (error) {
        console.error('Error confirming payment:', error); // Enhanced error log
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


// Adding logs to verifyRazorpayPayment
const verifyRazorpayPayment = async (req, res) => {
    try {
        console.log('verifyRazorpayPayment called'); // Debug log
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        const crypto = require('crypto');
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            console.log('Invalid signature'); // Debug log
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        console.log('verifyRazorpayPayment called with:', razorpay_order_id); // Debug log
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
        console.log('Order found:', order); // Debug log to confirm order find
        if (!order) {
            console.log('Order not found'); // Debug log
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Call confirmRazorpayPayment function to finalize the order
        req.body = {
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id
        };
        await confirmRazorpayPayment(req, res);
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error); // Enhanced error log
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const orderConfirm = async (req, res) => {
    try {
        if (!req.session.user) {
            res.redirect('/login');
        } else {
            res.render('user/confirm', { title: "Order Confirm" });
        }
    } catch (error) {
        res.redirect('/login');
    }
};

const getOrderDetails = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate('items.product')
            .populate('address');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.render('user/order-details', {
            title: "Order Details",
            order
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getUserOrders = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const orders = await Order.find({ user: userId })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });
console.log(orders)
        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('user/order', {
            orders,
            currentPage: page,
            totalPages,
            limit
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Server error');
    }
};

const cancelOrder = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const orderId = req.params.id;
        const userId = req.session.user._id;

        // Find the order
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if order can be cancelled
        if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Processing') {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
        }

        // Update stock for each product variant in the order
        for (let item of order.items) {
            await Product.updateOne(
                { _id: item.product, "variants.size": item.size },
                { $inc: { "variants.$.stock": item.quantity } }
            );
        }

        // Set order status to 'Cancelled'
        order.orderStatus = 'Cancelled';

         if (order.paymentMethod === 'Razorpay') {
            if (!order.razorpayPaymentId) {
                return res.status(400).json({ success: false, message: 'Payment ID is missing for Razorpay refund' });
            }

            try {
                // Fetch the payment details from Razorpay
                const razorpayPayment = await razorpayInstance.payments.fetch(order.razorpayPaymentId);

                // Check if already refunded
                if (razorpayPayment.status === 'refunded' || razorpayPayment.amount_refunded >= razorpayPayment.amount) {
                    return res.status(400).json({ success: false, message: 'The payment has already been fully refunded' });
                }

                // Initiate the refund
                const refund = await razorpayInstance.payments.refund(razorpayPayment.id, {
                    amount: razorpayPayment.amount
                });

                if (refund) {
                    // Handle refund success
                    const wallet = await Wallet.findOne({ userId });
                    if (!wallet) {
                        return res.status(400).json({ success: false, message: 'User wallet not found' });
                    }
                    wallet.balance += order.totalAmount;

                    const transaction = new Transaction({
                        userId,
                        amount: order.totalAmount,
                        description: 'Order refund',
                        type: 'credit',
                        status: 'completed'
                    });

                    await transaction.save();
                    wallet.transactions.push(transaction._id);
                    await wallet.save();
                } else {
                    console.error('Refund failed:', refund);
                    return res.status(500).json({ success: false, message: 'Refund failed' });
                }
            } catch (error) {
                console.error('Error processing Razorpay refund:', error);
                if (error.statusCode === 400 && error.error && error.error.description === 'The payment has been fully refunded already') {
                    return res.status(400).json({ success: false, message: 'The payment has already been fully refunded' });
                }
                return res.status(500).json({ success: false, message: 'Razorpay refund error' });
            }
        }


        // Save the order update
        await order.save();
        res.status(200).json({ success: true, message: 'Order cancelled and stock refilled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user._id;

        console.log(`Applying coupon for user: ${userId} with code: ${couponCode}`); // Debug log

        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon) {
            console.log('Invalid coupon code:', couponCode); // Debug log
            return res.status(400).json({ success: false, message: 'Invalid coupon' });
        }

        if (coupon.status !== 'Active') {
            console.log('Inactive coupon code:', couponCode); // Debug log
            return res.status(400).json({ success: false, message: 'Inactive coupon' });
        }

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            console.log('Empty cart for user:', userId); // Debug log
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        let totalAmount = cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

        // Check minimum purchase amount
        if (totalAmount < coupon.minPurchaseAmount) {
            console.log('Minimum purchase amount not met:', totalAmount); // Debug log
            return res.status(400).json({ success: false, message: `Minimum purchase amount is $${coupon.minPurchaseAmount}` });
        }

        const discountAmount = Math.min(coupon.discountRate / 100 * totalAmount, coupon.maxDiscount);
        totalAmount -= discountAmount;

        // Store coupon in session
        req.session.coupon = {
            code: couponCode,
            discountAmount,
            newTotal: totalAmount
        };

        // Save the new total amount in the coupon schema
        coupon.newTotalAmount = totalAmount;
        await coupon.save();

        console.log(`Coupon applied successfully. New total: ${totalAmount}, Discount: ${discountAmount}`); // Debug log
        res.status(200).json({ success: true, newTotal: totalAmount.toFixed(2), discountAmount: discountAmount.toFixed(2) });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user._id;

        console.log(`Removing coupon for user: ${userId}`); // Debug log

        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            console.log('Empty cart for user:', userId); // Debug log
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        let totalAmount = cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

        // Clear coupon from session
        delete req.session.coupon;

        console.log(`Coupon removed successfully. New total: ${totalAmount}`); // Debug log
        res.status(200).json({ success: true, totalAmount: totalAmount.toFixed(2) });
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



module.exports = {
    checkout,
    createOrder,
    createRazorpayOrder,
    confirmRazorpayPayment,
    verifyRazorpayPayment,
    orderConfirm,
    getOrderDetails,
    getUserOrders,
    cancelOrder,
    applyCoupon,
    removeCoupon
};
