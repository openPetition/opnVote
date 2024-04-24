"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    type: "mariadb",
    host: process.env.DB_HOST,
    port: 3306,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: ["src/models/*.ts"],
    synchronize: true,
    logging: false
};
