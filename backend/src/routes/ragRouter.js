// src/routes/ragRouter.js
import express from "express";
import { indexHandler, searchHandler } from "../controllers/ragIndexController.js";

const ragRouter = express.Router();

ragRouter.post("/index", indexHandler);
ragRouter.post("/search", searchHandler);

export default ragRouter;
