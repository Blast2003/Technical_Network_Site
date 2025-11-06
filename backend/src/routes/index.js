import ChatBotRouter from "./chatBotRouter.js";
import messageRouter from "./messageRouter.js";
import postRouter from "./postRouter.js";
import userRouter from "./userRouter.js";
import GitHubAuthRouter from "./GitHubAuthRouter.js";
import forumRouter from "./forumRouter.js";


export const router = (app) =>{
    app.use("/api/user", userRouter);
    app.use("/api/post", postRouter);
    app.use("/api/message", messageRouter);
    app.use("/api/bot", ChatBotRouter);
    app.use("/api/auth", GitHubAuthRouter);
    app.use("/api/forum", forumRouter);
}