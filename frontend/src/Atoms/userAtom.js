import { atom } from "recoil";

// state use one time => must combine with localStorage to become global
const userAtom = atom({
    key: "userAtom",
    default: JSON.parse(localStorage.getItem("user-network"))
})

export default userAtom