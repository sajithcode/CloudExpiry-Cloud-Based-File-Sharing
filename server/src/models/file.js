"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class File extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      File.belongsTo(models.User, { foreignKey: "user_id", as: "user" });
    }
  }
  File.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Users",
          key: "id",
        },
      },
      original_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      storage_key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      mime_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      download_token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      download_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      max_downloads: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "File",
      tableName: "files",
      underscored: true,
      indexes: [
        {
          fields: ["expires_at"],
        },
        {
          fields: ["download_token"],
          unique: true,
        },
        {
          fields: ["user_id"],
        },
      ],
    }
  );
  return File;
};
