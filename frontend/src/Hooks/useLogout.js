import { toast } from "react-toastify";
import { useSetRecoilState } from "recoil";
import userAtom from "../Atoms/userAtom";

import React from 'react'
import ggTokenAtom from "../Atoms/ghTokenAtom";

const useLogout = () => {
    const setUser = useSetRecoilState(userAtom);
    const setGHToken = useSetRecoilState(ggTokenAtom);

    const handleLogout = async() =>{
        try {
          const res = await fetch("/api/user/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
          })
    
          const data = res.json();
    
          if(data.error){
            toast.error(data.error);
            return;
          }
    
          localStorage.removeItem("user-network");
          setUser(null);
          setGHToken(null);
    
        } catch (error) {
          console.log(error)
        }
    }

    return handleLogout;
    
}

export default useLogout;
