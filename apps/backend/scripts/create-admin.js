"use strict";
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

async function main() {
  require("dotenv").config();
  const { Sequelize } = require("sequelize");

  const seq = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      dialect: "postgres",
      logging: false,
    }
  );

  try {
    await seq.authenticate();
    console.log("✅ Conectado a la base de datos");

    const email = "chacolla343@gmail.com";
    const password = "Cybercenter1";
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // Check if user already exists
    const [existing] = await seq.query(
      `SELECT id FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1`,
      { replacements: { email }, type: Sequelize.QueryTypes.SELECT }
    );

    if (existing) {
      await seq.query(
        `UPDATE users SET password_hash = :hash, role = 'admin', is_active = true,
         must_change_password = false, updated_at = NOW() WHERE email = :email`,
        { replacements: { hash, email }, type: Sequelize.QueryTypes.UPDATE }
      );
      console.log("✅ Cuenta admin actualizada:");
    } else {
      await seq.query(
        `INSERT INTO users (id, name, email, password_hash, role, is_active, must_change_password, created_at, updated_at)
         VALUES (:id, 'Pedro Chacolla', :email, :hash, 'admin', true, false, NOW(), NOW())`,
        { replacements: { id, email, hash }, type: Sequelize.QueryTypes.INSERT }
      );
      console.log("✅ Cuenta admin creada:");
    }

    console.log("   Email:    " + email);
    console.log("   Password: " + password);
    console.log("   Role:     admin");

    await seq.close();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

main();
