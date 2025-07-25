export const ormConfig = {
  type: "mariadb",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    "dist/models/**/*.js"
  ],
  synchronize: true,
  logging: false
};
