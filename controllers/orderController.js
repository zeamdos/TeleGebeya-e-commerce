const Order = require('../models/Order');

exports.createOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, phone, customerName, subcity, streetAddress, houseNumber, notes, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items in cart' });
    }

    const orderData = {
      user: req.user ? req.user.id : (req.body.user && req.body.user.length === 24 ? req.body.user : undefined),
      customerName: customerName || (req.user ? req.user.fullName : 'Customer'),
      phone: phone || (req.user ? req.user.phone : '0911000000'),
      subcity: subcity || 'Bole',
      streetAddress: streetAddress || '',
      houseNumber: houseNumber || '',
      shippingAddress: shippingAddress || `${subcity || 'Bole'}, ${streetAddress || ''} House #${houseNumber || ''}`,
      notes: notes || '',
      items: items.map(item => ({
        product: item.productId || item.product || item._id,
        name: item.name || item.title,
        imageUrl: item.imageUrl,
        quantity: item.quantity || 1,
        price: item.price
      })),
      totalAmount,
      paymentMethod: paymentMethod || 'telebirr',
      paymentStatus: paymentMethod === 'telebirr' ? 'pending' : 'pending',
      orderStatus: 'confirmed'
    };

    const order = new Order(orderData);
    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { user: req.user.id },
        { phone: req.user.phone }
      ]
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).populate('user', 'id fullName phone');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
