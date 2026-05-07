const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Donation', {
    id: { 
      type: DataTypes.INTEGER, 
      autoIncrement: true, 
      primaryKey: true 
    },
    campaignId: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'Campaigns', key: 'id' }
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
      type: DataTypes.ENUM('pending', 'processing', 'succeeded', 'failed', 'refunded'),
      defaultValue: 'pending' 
    },
    paymentMethod: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    recurringType: { 
      type: DataTypes.ENUM('one-time', 'monthly', 'yearly'),
      defaultValue: 'one-time' 
    },
    stripePaymentIntentId: { 
      type: DataTypes.STRING, 
      allowNull: true,
      unique: true
    },
    stripeSubscriptionId: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    midtransTransactionId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    midtransTransactionToken: {
      type: DataTypes.TEXT,
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
    },
    failureReason: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
    processedAt: { 
      type: DataTypes.DATE, 
      allowNull: true 
    }
  }, {
    timestamps: true,
    indexes: [
      { fields: ['campaignId', 'paymentStatus'] },
      { fields: ['userId'] },
      { fields: ['stripePaymentIntentId'] },
      { fields: ['midtransTransactionId'] }
    ]
  });
};
