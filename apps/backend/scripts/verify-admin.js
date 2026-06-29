"use strict";
require("dotenv").config();
const { Sequelize } = require("sequelize");

const seq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  { host: process.env.DB_HOST, dialect: "postgres", logging: false }
);

seq
  .query(
    "SELECT id, name, email, role, is_active, must_change_password, deleted_at FROM users WHERE email = 'chacolla343@gmail.com'",
    { type: Sequelize.QueryTypes.SELECT }
  )
  .then((rows) => {
    console.log(JSON.stringify(rows, null, 2));
    seq.close();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
