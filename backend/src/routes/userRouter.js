import express from "express";
import { protectRoutes } from "../middleware/protectRoutes.js";
import { UserLogin, UserSignup, UserLogout, FollowAndUnFollowUser, updateUser, getUserProfile, getSuggestedUsers, freezeAccount, getFollowingId, FilterFollowingUser, SearchUserToMakeConversation, SearchUsers, UserSigInWithGitHub, UserSigInWithGoogle} from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.post("/signup", UserSignup)
userRouter.post("/login", UserLogin)
userRouter.post("/login/github", UserSigInWithGitHub)
userRouter.post("/login/google", UserSigInWithGoogle)
userRouter.post("/logout", UserLogout)
userRouter.post("/follow/:id", protectRoutes ,FollowAndUnFollowUser)
userRouter.put("/update/:id", protectRoutes ,updateUser)

userRouter.get("/profile/:query", getUserProfile)
userRouter.get ("/suggested", protectRoutes, getSuggestedUsers)
userRouter.get ("/following", protectRoutes, getFollowingId)
userRouter.put("/freeze", protectRoutes ,freezeAccount)

userRouter.get("/follow", protectRoutes, FilterFollowingUser)
userRouter.get("/search/:Term", protectRoutes, SearchUserToMakeConversation)
userRouter.get("/searchUsers/:Term", protectRoutes, SearchUsers)



export default userRouter;