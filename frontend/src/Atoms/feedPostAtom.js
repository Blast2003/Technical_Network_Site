import { atom } from "recoil";

const feedPostAtom = atom({
	key: "feedPostAtom",
	default: [],
});

export default feedPostAtom;