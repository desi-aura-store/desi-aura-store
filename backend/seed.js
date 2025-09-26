// backend/seed.js
const { sequelize, Product } = require('./models');

const products = [
   { 
     "name": "Bright LED Solar Wall Lights for Outdoor", 
     "description": `Illuminate Your Outdoors with the <strong>Bright LED Solar Wall Light</strong> for Enhanced Security

Introducing our powerful and efficient <strong>Bright LED Solar Wall Light</strong>, designed to bring superior illumination and peace of mind to your outdoor spaces. This sleek, black wall lamp and sconce is the perfect solution for enhancing security and visibility around your home, garden, or pathways.

<strong>Key Features:</strong>

<strong>Brilliant LED Illumination:</strong> Equipped with bright, energy-efficient LEDs, this wall light provides powerful illumination, ensuring clear visibility and deterring unwanted visitors.

<strong>Solar-Powered Efficiency:</strong> Harnessing the sun's energy, this light charges during the day and automatically illuminates your surroundings at night. Say goodbye to electricity bills and complicated wiring!

<strong>Durable & Weatherproof Design:</strong> Built to withstand the elements, this outdoor light is fully waterproof, ensuring reliable performance rain or shine.

<strong>Easy Installation:</strong> With no wiring required, simply mount it on any wall and let the sun do the rest.
<strong>Sleek Black Finish:</strong> Its modern black design seamlessly blends with any exterior decor.
<strong>Bulb Included:</strong> Ready to use right out of the box, with bulbs pre-installed for your convenience.
Add a layer of safety and style to your outdoor areas with this high-quality, eco-friendly solar wall light.

<strong>Country of Origin:</strong> India
<strong>Net Quantity (N):</strong> 1
`, 
     "price": 359, 
     "originalPrice": 999,
     "category": "Men", 
     "image": "solar-lamp-1.png,solar-lamp-2.png,solar-lamp-3.png,solar-lamp-4.png", 
     "stock": 50 
   },
   { 
     "name": "Silk Saree", 
     "description": "<strong>Banarasi silk saree</strong> with <strong>zari border</strong>", 
     "price": 4999, 
     "originalPrice": 6999,
     "category": "Women", 
     "image": "saree1.jpg", 
     "stock": 20 
   },
   { 
     "name": "Casual Shirt", 
     "description": "<strong>Slim-fit cotton shirt</strong> for daily wear", 
     "price": 899, 
     "originalPrice": 1299,
     "category": "Men", 
     "image": "shirt1.jpg", 
     "stock": 100 
   },
];

(async () => {
  try {
    await sequelize.sync({ force: true });
    await Product.bulkCreate(products);
    console.log('✅ Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();