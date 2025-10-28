"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("files", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("(uuid())"),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      original_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      storage_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      mime_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      download_token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      download_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      max_downloads: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    // Add indexes
    await queryInterface.addIndex("files", ["expires_at"]);
    await queryInterface.addIndex("files", ["download_token"], {
      unique: true,
    });
    await queryInterface.addIndex("files", ["user_id"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("files");
  },
};
