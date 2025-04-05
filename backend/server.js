import express from "express";
import { Variables } from "./src/config/variables.js";
import cookieParser from "cookie-parser";
import { router } from "./src/routes/index.js";
import { connectToDatabase, sequelize } from "./src/config/database.js";
import cors from "cors"

import dotenv from "dotenv";
import {v2 as cloudinary} from "cloudinary"
import {app, server} from "./src/socket/socket.js"
// import {Post} from "./src/models/postModel.js"

dotenv.config();

cloudinary.config({
    cloud_name: Variables.CLOUDINARY_CLOUD_NAME,
    api_key: Variables.CLOUDINARY_API_KEY,
    api_secret: Variables.CLOUDINARY_API_SECRET
});


const PORT = Variables.PORT;



//middlewares 
// to parse JSON data in the req.body, exceed the limit of json data to upload large file
app.use(express.json({limit: "50mb"}));
app.use(express.urlencoded({ extended: true })); // To parse form data in the req.body = use image
app.use(cookieParser());
app.use(cors());


// Routes 
router(app);


connectToDatabase()
    .then(() => {
        console.log("🚀 Starting server...");
        server.listen(PORT, () => console.log(`✅ Server Listening on port: ${PORT}`));
    })
    .catch((err) => {
        console.error("❌ Database connection failed. Shutting down server.");
        process.exit(1);
    });