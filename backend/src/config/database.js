import Sequelize  from "sequelize";

import dotenv from "dotenv";
import { Variables } from "./variables.js";
import fs from "fs";

dotenv.config();

const sequelize = new Sequelize(
  Variables.MYSQL_DATABASE_NAME,
  Variables.MYSQL_USER,
  Variables.MYSQL_PASSWORD,
  {
    host: Variables.MYSQL_HOST,
    port: Variables.MYSQL_PORT,
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        ca: fs.readFileSync(Variables.CA)
      }
    }
  }
);


const connectToDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
      } catch (error) {
        console.error('Unable to connect to the database:', error);
      }
};


export {connectToDatabase, sequelize};