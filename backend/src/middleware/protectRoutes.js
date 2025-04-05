import jwt from "jsonwebtoken";
import { Variables } from "../config/variables.js"
import { User } from "../models/userModel.js";

export const protectRoutes = async (req, res, next) =>{
    try {
        const token = req.cookies["jwt-social"];
        if(!token) return res.status(401).json({message:"Unauthorized! Click Home to login!"});

        const decode = jwt.verify(token, Variables.JWT_SECRET_KEY);

        if(!decode) return res.status(401).json({message:"Unauthorized - No Token Provided"});

        const user = await User.findByPk(decode.id, {
            attributes: { exclude: ["password"] },
        })

        req.user = user.dataValues;
        next(); // go to the next part of the router

    } catch (error) {
        console.log("Error from Protect Routes Middleware", error.message);
        return res.status(500).json({message: error.message});
    }
};
