const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ChatbotInteraction = sequelize.define('ChatbotInteraction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      index: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    source: {
      type: DataTypes.STRING(50),
      defaultValue: 'kb'
    },
    aiModel: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    helpful: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'chatbot_interactions',
    timestamps: true
  });

  return ChatbotInteraction;
};
