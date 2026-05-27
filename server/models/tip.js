const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Tip', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'IDR'
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'processing', 'succeeded', 'failed'),
      defaultValue: 'pending'
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true
    },
    midtransTransactionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    donorName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    donorEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['midtransTransactionId'] }
    ]
  });
};
