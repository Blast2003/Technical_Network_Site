import { createContext, useContext, useEffect, useState } from "react";
import { useRecoilValue } from "recoil";
import io from "socket.io-client";
import userAtom from "../Atoms/userAtom";

const SocketContext = createContext();

// function help to retrieve socket => emit the new events in client side
export const useSocket = () => { 
	return useContext(SocketContext);
};

export const SocketContextProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [onlineUsers, setOnlineUsers] = useState([]); // array of userId
	const user = useRecoilValue(userAtom);

	useEffect(() => {
		const socket = io("http://localhost:5080", {
			query: {
				userId: user?.id,
			},
		});

		setSocket(socket);

        // listen for event in both client and server
		socket.on("getOnlineUsers", (users) => {
			setOnlineUsers(users);
		});


		return () => socket && socket.close();
	}, [user?.id]);

    console.log("Online users", onlineUsers)

	return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};