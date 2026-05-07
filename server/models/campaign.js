const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Campaign', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    goal: { type: DataTypes.DECIMAL, defaultValue: 0 },
    collected: { type: DataTypes.DECIMAL, defaultValue: 0 },
    creatorEmail: { type: DataTypes.STRING },
    organizer: { type: DataTypes.STRING },
    location: { type: DataTypes.STRING },
    category: { type: DataTypes.STRING },
    image: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    daysLeft: { type: DataTypes.INTEGER, defaultValue: 30 },
    fullDescription: { type: DataTypes.TEXT }
  });
};
