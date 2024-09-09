
const Cart = require('../model/cartSchema');
const User = require('../model/userSchema');
const Address = require('../model/addressSchema');
const Order = require('../model/orderSchema');
const Product = require('../model/productSchema');
const Coupon = require('../model/couponSchema');
const Wallet = require('../model/walletSchema');
const Transaction = require('../model/transactionSchema');
const Razorpay = require('razorpay');
const pdf = require('pdfkit')
const fs = require('fs')
const path = require('path')


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

        
            const wallet = await Wallet.findOne({ _id: userId });
            console.log(wallet);
            console.log(userId);

        if (!cart) {
            return res.redirect('/cart'); 
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
            couponDetails, 
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
        const { addressId, paymentMethod, couponCode } = req.body;

        // Fetch the user's cart
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        // Check the quantity of each product in the cart against the available stock
        for (const item of cart.items) {
            if (item.quantity > item.product.stock) {
                return res.status(404).json({
                    success: false,
                    message: `Product ${item.product.name} quantity is not available`
                });
            }
        }

        // Fetch the address details
        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Prepare order items
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            size: item.size,
            quantity: item.quantity,
            price: item.product.price
        }));

        // Calculate the total amount and apply any discounts if applicable
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

        // Handle Wallet payment
        if (paymentMethod === 'Wallet') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                console.error('Wallet not found for user:', userId);
                return res.status(404).json({ success: false, message: 'Wallet not found' });
            }

            if (wallet.balance < totalAmount) {
                console.error('Insufficient Wallet Balance:', wallet.balance, 'Required:', totalAmount);
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
            }

            // Deduct the amount from the wallet balance
            wallet.balance -= totalAmount;
            await wallet.save();

            // Create a wallet transaction
            const transaction = new Transaction({
                userId,
                amount: totalAmount,
                description: 'Order Payment via Wallet',
                type: 'debit',
                status: 'completed'
            });
            await transaction.save();

            // Add the transaction to the wallet's transactions list
            wallet.transactions.push(transaction._id);
            await wallet.save();

            paymentStatus = 'Paid';
        }

        // Create the order
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
            orderStatus: paymentMethod === 'Wallet' ? 'Processing' : 'Pending',
        });

        await order.save(); 

        // Reduce stock for each product variant in the order
        for (const item of cart.items) {
            const product = await Product.findById(item.product._id);
            const variant = product.variants.find(v => v.size === item.size);
            if (variant) {
                variant.stock -= item.quantity;
            }
            await product.save();
        }

        // Clear the cart after the order is placed
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
            amount: totalAmount * 100, 
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

        // If we reached here, the payment is verified successfully
        order.paymentStatus = 'Paid'; // Set to paid only if verified
        order.razorpayPaymentId = razorpayPaymentId;
        order.orderStatus = 'Pending'; // You may choose to change this based on your order flow (e.g., "Processing")
        await order.save();

        // Handle cart clearing and stock update logic here
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

        // Referral reward logic
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

        // Check if signature is valid
        if (generatedSignature !== razorpay_signature) {
            console.log('Invalid signature'); // Debug log
            // Update order to failed status if signature is invalid
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (order) {
                order.paymentStatus = 'Failed';
                await order.save();
            }
            return res.status(400).json({ success: false, message: 'Invalid signature, payment failed' });
        }

        console.log('Signature valid, proceeding with payment confirmation'); // Debug log

        // If valid, proceed to confirm payment
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

const generateInvoice = async (order) => {
    const invoicesDir = path.join(__dirname, '..', 'invoices');

    try {
        // Check if the invoices directory exists, create it if not
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir, { recursive: true });
        }
    } catch (err) {
        console.error('Error creating invoices directory:', err);
        throw new Error('Error creating invoices directory');
    }

    const filePath = path.join(invoicesDir, `${order._id}.pdf`);

    return new Promise((resolve, reject) => {
        try {
            const doc = new pdf();
            const writeStream = fs.createWriteStream(filePath);

            doc.pipe(writeStream);

            // Add title next to the logo
            doc.fontSize(20).text('SmileShop', { align: 'center' });

            // Add the header text
            doc.moveDown();
            doc.fontSize(25).text('Invoice', { align: 'center' });
            doc.moveDown();

            // Initialize position for item details
            let position = 150; // Starting Y position for the table
            const indexX = 50;
            const descriptionX = 100;
            const quantityX = 280;
            const priceX = 370;
            const amountX = 460;

            // Table header
            doc.fontSize(12)
                .text('Index', indexX, position)
                .text('Description', descriptionX, position)
                .text('Quantity', quantityX, position)
                .text('Price', priceX, position)
                .text('Amount', amountX, position);
            position += 20;

            // Table content and total amount calculation
            let totalAmount = 0;
            order.items.forEach((item, index) => {
                const itemAmount = item.quantity * item.price;
                totalAmount += itemAmount;

                doc.fontSize(10)
                    .text(index + 1, indexX, position)
                    .text(item.product.name, descriptionX, position)
                    .text(item.quantity, quantityX, position)
                    .text(`₹${item.price.toFixed(2)}`, priceX, position)
                    .text(`₹${itemAmount.toFixed(2)}`, amountX, position);
                position += 20;
            });

            // Add the total amount
            position += 20;
            doc.fontSize(12).text('Total:', priceX, position, { align: 'left' });
            doc.fontSize(12).text(`₹${order.totalAmount.toFixed(2)}`, amountX, position, { align: 'right' });

            // Move down before adding additional details
            position += 40;
            doc.moveDown();

            // Add shipping address, payment method, and status
            doc.fontSize(14).text('Shipping Address:', indexX, position);
            position += 20;
            doc.fontSize(12).text(`${order.addressSnapshot.place}, ${order.addressSnapshot.houseNumber}`, indexX, position);
            position += 15;
            doc.text(`${order.addressSnapshot.street}`, indexX, position);
            position += 15;
            doc.text(`${order.addressSnapshot.city}, ${order.addressSnapshot.zipcode}, ${order.addressSnapshot.country}`, indexX, position);

            position += 30;
            doc.fontSize(14).text('Payment Method:', indexX, position);
            position += 20;
            doc.fontSize(12).text(order.paymentMethod, indexX, position);

            position += 30;
            doc.fontSize(14).text('Payment Status:', indexX, position);
            position += 20;
            doc.fontSize(12).text(order.paymentStatus, indexX, position);

            position += 30;
            doc.fontSize(14).text('coupon applied:', indexX, position);
            position += 20;
            doc.fontSize(12).text(order.discountAmount, indexX, position);

            // End the PDF document
            doc.end();

            writeStream.on('finish', () => {
                console.log(`Invoice generated successfully at ${filePath}`);
                resolve(filePath);
            });

            writeStream.on('error', (err) => {
                console.error('Error writing PDF to file:', err);
                reject(new Error('Error generating invoice PDF'));
            });
        } catch (err) {
            console.error('Error generating invoice PDF:', err);
            reject(new Error('Error generating invoice PDF'));
        }
    });
};


// Route to handle invoice download
const downloadInvoice = async (req, res) => {
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

        const filePath = await generateInvoice(order);

        // Check if the file was created successfully
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            console.error('Invoice file does not exist:', filePath);
            res.status(500).json({ success: false, message: 'Error generating invoice file' });
        }
    } catch (error) {
        console.error('Error generating invoice:', error);
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

        // Handle refund based on payment method
        if (order.paymentMethod === 'Wallet') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                return res.status(400).json({ success: false, message: 'User wallet not found' });
            }
            // Refund the amount to the wallet
            wallet.balance += order.totalAmount;

            // Create a new transaction for the refund
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
        }else if (order.paymentMethod === 'Razorpay') {
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
    downloadInvoice,
    orderConfirm,
    getOrderDetails,
    getUserOrders,
    cancelOrder,
    applyCoupon,
    removeCoupon
};
