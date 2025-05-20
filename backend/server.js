import express from "express";
import { Variables } from "./src/config/variables.js";
import cookieParser from "cookie-parser";
import { router } from "./src/routes/index.js";
import { connectToDatabase, sequelize } from "./src/config/database.js";
import cors from "cors"

import dotenv from "dotenv";
import {v2 as cloudinary} from "cloudinary"
import {app, server} from "./src/socket/socket.js"
import { initLangChain } from "./src/lib/langchain.js";
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


async function main() {
  // 1) Connect to MySQL/TiDB
  await connectToDatabase();
  console.log("✅ Database connected");

  // 2) Init LangChain + Ollama + SQLChain
  await initLangChain();
  console.log("✅ LangChain SQL chain initialized");

  // 3) Start server (with socket)
  server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});