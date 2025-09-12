// backend/seed.js
const { sequelize, Product } = require('./models');

const products = [
   { "name": "Cotton Kurta", "description": "Handwoven cotton kurta with traditional embroidery", "price": 1199, "category": "Men", "image": "kurta1.jpg,kurta1-1.jpg,kurta1-2.jpg,kurta1-3.jpg", "stock": 50 },
  { "name": "Silk Saree", "description": "Banarasi silk saree with zari border", "price": 4999, "category": "Women", "image": "saree1.jpg", "stock": 20 },
  { "name": "Casual Shirt", "description": "Slim-fit cotton shirt for daily wear", "price": 899, "category": "Men", "image": "shirt1.jpg", "stock": 100 },
];

(async () => {
  try {
    await sequelize.sync({ force: true }); // wipe + recreate tables
    await Product.bulkCreate(products);    // insert all at once
    console.log('✅ Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
