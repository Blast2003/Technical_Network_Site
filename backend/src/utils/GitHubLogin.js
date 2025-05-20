import axios from "axios";
import {Variables} from "../config/variables.js";

export const GitHubLogin = async (req, res) => {
    const { code } = req.body;
    try {
      // 1) Exchange code for access token
      const tokenResponse = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id:  Variables.GH_CLIENT_ID,
          client_secret: Variables.GH_CLIENT_SECRET,
          code,
        },
        { headers: { accept: "application/json" } }
      );
  
      const access_token = tokenResponse.data.access_token;
      if (!access_token) {
        return res.status(400).json({ error: "No access token from GitHub" });
      }
  
      // 2) Fetch the GitHub user
      const userResponse = await axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
  
      // 3) Return both token + user data to the frontend
      return res.json({
        access_token,
        login:       userResponse.data.login,
        id:          userResponse.data.id,
        avatar_url:  userResponse.data.avatar_url,
        // …any other fields you need
      });
    } catch (err) {
      console.error("GitHub OAuth error:", err);
      return res.status(500).json({ error: "GitHub OAuth failed" });
    }
  }