import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { testDataset } from "../controllers/datasetTestController.js";

const testToxicityRouter = express.Router();

testToxicityRouter.post("/test-dataset", protectRoutes, testDataset)

export default testToxicityRouter;