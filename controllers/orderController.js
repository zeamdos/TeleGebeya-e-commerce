const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  const { items, totalAmount, shippingAddress } = req.body;

  if (items && items.length === 0) {
    return res.status(400).json({ message: 'No order items' });
  } else {
    const order = new Order({
      user: req.user.id,
      items,
      totalAmount,
      shippingAddress,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'id name email');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
