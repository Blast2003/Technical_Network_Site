import { Op } from "sequelize";
import { User } from "../models/userModel.js";
import  {Message, MessagesConversation, MessagesSender } from "../models/messageModel.js";
import { Conversation, ConversationParticipant } from "../models/conversationModel.js";
import { getRecipientSocketId, io } from "../socket/socket.js";
import { v2 as cloudinary } from "cloudinary";
import { console } from "inspector";

// create Message
export const sendMessage = async (req, res) => {
  try {
      const { recipientId, message } = req.body;
      let { img } = req.body;
      const senderId = req.user.id;

      if(recipientId === senderId.toString()){
        return res.status(400).json({error: "You can not send messages to yourself!"})
      }

      // Step 1: Find all conversations that senderId is part of
      const senderConversations = await ConversationParticipant.findAll({
        where: { user_id: senderId },
        attributes: ['conversation_id'],
      });



      let conversation;
      // Extract conversation IDs from sender's conversations
      const conversationIds = senderConversations.map(convo => convo.conversation_id);

      // Step 2: Find a conversation where recipientId is also a participant
      const existingConversation = await Conversation.findOne({
        where: { id: conversationIds }, // Only check sender's conversations
          include: [
            {
              model: ConversationParticipant,
              as: 'participants',
              where: { user_id: recipientId }, // Ensure recipient is also in the conversation
            },
          ],
      });

      conversation = existingConversation;

      if ( !conversation) {
        conversation = await Conversation.create();

        // Add sender and recipient as participants
        await ConversationParticipant.bulkCreate([
            { conversation_id: conversation.id, user_id: senderId },
            { conversation_id: conversation.id, user_id: recipientId },
        ]);
      }

      // Upload image to Cloudinary if provided
      if (img) {
          const uploadedResponse = await cloudinary.uploader.upload(img);
          img = uploadedResponse.secure_url;
      }

      // Update `lastMessage = false` for all previous messages in the conversation
      const previousMessages = await MessagesConversation.findAll({
        where: { conversation_id: conversation.id },
        attributes: ['message_id'],
      });

      const previousMessageIds = previousMessages.map(msg => msg.message_id);

      if (previousMessageIds.length > 0) {
          await Message.update(
              { lastMessage: false },
              { where: { id: previousMessageIds } }
          );
      }

      //Create the new message with `lastMessage = true`
      const newMessage = await Message.create({
          text: message,
          img: img || "",
          lastMessage: true,  // Mark this message as the latest
      });

      // Link the message with the conversation in MessagesConversation
      await MessagesConversation.create({
        message_id: newMessage.id,
        conversation_id: conversation.id,
      });

      // Step 6: Link the message with the sender in MessagesSender
      await MessagesSender.create({
          message_id: newMessage.id,
          user_id: senderId,
      });

      const customNewMEssage = {...newMessage.toJSON(), sender: senderId, conversationId: conversation.id}

      // Emit the new message to the recipient
      const recipientSocketId = getRecipientSocketId(recipientId);
      const senderSocketId = getRecipientSocketId(senderId);
      if (recipientSocketId && senderSocketId) {
          io.to(recipientSocketId).emit("newMessage", customNewMEssage);
          io.to(senderSocketId).emit("newMessage", customNewMEssage);
      }

      return res.status(201).json(customNewMEssage);
  } catch (error) {
      console.log("Error in sendMessage", error.message);
      return res.status(500).json({
          error: `Internal Server Error in sendMessage: ${error.message}`,
      });
  }
};

// get all messages in a conversation between current user and specific other user  
export const getMessages = async (req, res) => {
    const { otherUserId } = req.params;
  
    try {
      const userId = req.user.id;
  
      //Check if a conversation exists between the two users
      const conversationParticipant = await ConversationParticipant.findOne({
        where: { user_id: userId }, // Match the current user's participation
        include: {
          model: Conversation,
          as: 'conversation', 
          required: true,
          include: [
            {
              model: ConversationParticipant,
              as: 'participants', 
              required: true,
              where: { user_id: otherUserId }, // Match the other user's participation
            },
          ],
        },
      });
  
      // If no conversation is found
      if (!conversationParticipant || !conversationParticipant.conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
  
      const conversationId = conversationParticipant.conversation.id;
  
      const messages = await Message.findAll({
        include: [
          {
            model: MessagesConversation,
            as: 'messagesConversations',
            required: true,
            where: { conversation_id: conversationId }, // Filter by conversationId
        },
        {
          model: MessagesSender,
          as: 'messagesSender',
          required: true,
      },
        ],
        order: [["createdAt", "ASC"]], // Sort messages in ascending order
      });

      const customMessage = messages.map((message) =>{
        return {
          ...message.toJSON(),
          conversationId: message.messagesConversations[0].conversation_id,
          sender: message.messagesSender[0].user_id
        }
      })

      return res.status(200).json(customMessage);
    } catch (error) {
      console.log("Error in getMessages", error.message)
      return res.status(500).json({
        error: `Internal Server Error in getMessages: ${error.message}`,
      });
    }
};
  

// get conversation with only your friend to render conversation container in the left hand side below search bar
export const getConversations = async (req, res) => {
  const userId = req.user.id;
  try {
    // Find all conversation IDs where the user is a participant
    const conversationParticipants = await ConversationParticipant.findAll({
      where: { user_id: userId },
      attributes: ['conversation_id'], // Only fetch conversation_id
    });

    if (!conversationParticipants || conversationParticipants.length === 0) {
      return res.status(200).json({ message: "You don't have any conversation before" });
    }

    const conversationsWithLastMessage = await Promise.all(
      conversationParticipants.map(async (participant) => {
        const conversationId = participant.conversation_id;

        // Get the last message in the conversation by joining with MessagesConversation
        const lastMessage = await Message.findOne({
          include: {
            model: MessagesConversation,
            as: 'messagesConversations',
            required: true,
            where: { conversation_id: conversationId }, // Filter by conversation_id
          },
          where: { lastMessage: true }, // Get the last message flag
          order: [['createdAt', 'DESC']],
          attributes: ['text', 'createdAt', 'updatedAt', 'img'],
        });

        // Get the other participant's info (excluding current user)
        const otherParticipant = await ConversationParticipant.findOne({
          where: { conversation_id: conversationId, user_id: { [Op.ne]: userId } },
          include: [
            {
              model: User,
              attributes: ['id', 'username', 'profilePic'],
            },
          ],
          attributes: [], // Exclude ConversationParticipant fields
        });

        return {
          lastMessage: lastMessage ? lastMessage.text : "",
          updatedLastMessage: lastMessage ? lastMessage: null,
          img: lastMessage ? lastMessage.img : '',
          conversationId: conversationId, // Get conversation ID directly
          createdTime: lastMessage ? lastMessage.createdAt : '',
          otherUsername: otherParticipant ? otherParticipant.User.username : '',
          otherUserId: otherParticipant ? otherParticipant.User.id : '',
          otherProfilePic: otherParticipant ? otherParticipant.User.profilePic : '',
        };
      })
    );

    // Sort conversations by createdTime in descending order
    conversationsWithLastMessage.sort((a, b) => {
      return new Date(b.createdTime) - new Date(a.createdTime);
    });

    return res.status(200).json(conversationsWithLastMessage);
  } catch (error) {
    console.log("Error in getConversations", error.message);
    return res.status(500).json({ error: `Internal Server Error in getConversations: ${error.message}` });
  }
};
  
  
  
  