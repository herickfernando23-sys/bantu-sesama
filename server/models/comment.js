const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Comment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.TEXT, allowNull: false }
  });
};
