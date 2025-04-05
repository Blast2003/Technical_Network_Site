import jwt from "jsonwebtoken";
import {Variables} from "../config/variables.js"

export const generateTokenAndSetCookie = (payload, res) =>{
    const token = jwt.sign({...payload}, Variables.JWT_SECRET_KEY,{
        expiresIn: '15d',
    })

    res.cookie("jwt-social", token, {
        httpOnly: true, // more secure => the cookie cannot be accessed by JavaScript on the client side
        maxAge: 15*24*60*60 *1000,
        sameSite: "strict"  // CSRF
    })

    return token;
}