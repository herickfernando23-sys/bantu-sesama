const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Campaign', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    goal: { type: DataTypes.DECIMAL, defaultValue: 0 },
    collected: { type: DataTypes.DECIMAL, defaultValue: 0 }
  });
};
