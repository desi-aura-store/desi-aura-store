// backend/models.js
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

let sequelize;
if (process.env.DATABASE_URL) {
  // Production: Postgres (Render). Allow SSL.
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false }
    },
    logging: false
  });
} else {
  // Local dev: SQLite file
  const path = require('path');

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),  // ✅ always backend/database.sqlite
    logging: false
  });
}

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: { type: DataTypes.STRING, allowNull: false },   // ✅ renamed from "title"
  description: { type: DataTypes.TEXT, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  originalPrice: { type: DataTypes.FLOAT, allowNull: true }, // ✅ Added originalPrice field
  category: { type: DataTypes.STRING, allowNull: false },
  image: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.INTEGER, defaultValue: 100 }
});


const Order = sequelize.define('Order', {
  customerName: { type: DataTypes.STRING, allowNull: false },
  customerEmail: { type: DataTypes.STRING },
  customerPhone: { type: DataTypes.STRING },
  address: { type: DataTypes.TEXT, allowNull: false },
  items: { type: DataTypes.TEXT, allowNull: false }, // store JSON string
  total: { type: DataTypes.FLOAT, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

module.exports = { sequelize, Product, Order };