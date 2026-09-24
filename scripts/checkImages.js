require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const rows = await Product.aggregate([
    { $project: {
        name: 1,
        img: { $strLenCP: { $ifNull: ['$imageUrl', ''] } },
        thumb: { $strLenCP: { $ifNull: ['$thumbnailUrl', ''] } }
    } },
    { $sort: { img: -1 } }
  ]);
  rows.forEach(r => console.log(`${r._id} | ${r.name} | image: ${r.img} | thumb: ${r.thumb}`));
  console.log('total products:', rows.length);
  await mongoose.disconnect();
})();
