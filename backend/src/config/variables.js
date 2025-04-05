import dotenv from "dotenv";

dotenv.config();

export const Variables = {
    PORT: process.env.PORT || 5080,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE_NAME: process.env.MYSQL_DATABASE_NAME,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PORT: process.env.MYSQL_PORT,
    CA: process.env.CA,
    JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    GG_API_KEY: process.env.GG_API_KEY,
}