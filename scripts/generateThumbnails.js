require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { generateThumbnail } = require('../utils/imageThumbnail');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI); // use whatever your .env variable is called
  const filter = { $or: [{ thumbnailUrl: { $exists: false } }, { thumbnailUrl: '' }] };

  let done = 0;
  for await (const p of Product.find(filter).select('imageUrl').cursor()) {
    const thumb = await generateThumbnail(p.imageUrl);
    await Product.updateOne({ _id: p._id }, { $set: { thumbnailUrl: thumb } });
    done++;
    console.log(`${p._id}: ${p.imageUrl?.length} -> ${thumb?.length} chars`);
  }
  console.log(`Done, ${done} products updated`);
  await mongoose.disconnect();
})();
