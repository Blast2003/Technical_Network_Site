import {Server} from "socket.io"
import http from "http"
import express from "express"
import {Message, MessagesConversation, MessagesSender} from "../models/messageModel.js";
import { Notification } from "../models/notificationModel.js";


const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
})

// socket server for client -> handle multiple connections for each user
const io = new Server(server, {  
    cors: {
        origin: "http://localhost:4500",
        methods: ["GET", "POST"]
    }
}); 


export const getRecipientSocketId = (recipientId) => { // userId
	return userSocketMap[recipientId];
};


const userSocketMap = {}; // userId: socketId

io.on("connection", (socket) =>{
    console.log("user connected", socket.id);

    const userId = socket.handshake.query.userId;

    if(userId && userId != "undefined"){
        userSocketMap[userId] = socket.id;
    }

    // create events
    io.emit("getOnlineUsers", Object.keys(userSocketMap)) // key = userId -> online

    // handle mark messages when we seen
    socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
        try {
            // Find all messages in the conversation sent by the user and not yet seen
            const messagesToUpdate = await Message.findAll({
                include: [
                    {
                        model: MessagesSender,
                        as: 'messagesSender',
                        where: { user_id: userId }, 
                        attributes: [],
                    },
                    {
                        model: MessagesConversation,
                        as: 'messagesConversations',
                        where: { conversation_id: conversationId }, 
                        attributes: [],
                    }
                ],
                where: { seen: false }, // Only update unseen messages
            });
    
            if (messagesToUpdate.length > 0) {
                // Update the seen status
                await Message.update(
                    { seen: true },
                    {
                        where: { 
                            id: messagesToUpdate.map(msg => msg.id) // Update only found messages
                        }
                    }
                );
    
                // Emit an event to notify the recipient that messages are seen
                const recipientSocketId = getRecipientSocketId(userId);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit("messagesSeen", { conversationId });
                }
            }
        } catch (error) {
            console.log(error);
        }
    });
    

    socket.on("markNotificationsAsSeen", async ({ userId }) => {
        try {
          // Update all notifications for this user that are not yet seen.
          await Notification.update(
            { seen: true },
            {
              where: {
                recipient_id: userId,
                seen: false,
              },
            }
          );
          // After updating, notify the user that their notifications have been seen.
          const recipientSocketId = getRecipientSocketId(userId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit("NotificationsSeen", { userId });
          }
        } catch (error) {
          console.log("Error marking notifications as seen:", error);
        }
    });


    socket.on("disconnect", () =>{ 
        console.log("user disconnected", socket.id);
        delete userSocketMap[userId];
        
        // send events
        io.emit("getOnlineUsers", Object.keys(userSocketMap)) // key = userId -> offline
    })
})

export {io, server, app};

