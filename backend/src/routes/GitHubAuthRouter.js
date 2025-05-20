import express from "express";
import {GitHubLogin} from "../utils/GitHubLogin.js";

const GitHubAuthRouter = express.Router();

GitHubAuthRouter.post("/github/callback", GitHubLogin)

export default GitHubAuthRouter;