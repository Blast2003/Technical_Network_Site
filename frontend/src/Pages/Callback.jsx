import { useRecoilState } from 'recoil';
import loader from '../assets/loader.svg'
import { getAccessToken, getUserData } from '../Callback/callback';
import { useEffect } from 'react';
import ghTokenAtom from '../Atoms/ghTokenAtom';
import userAtom from '../Atoms/userAtom';

const Callback = () => {
  const [GHToken, setGHToken] = useRecoilState(ghTokenAtom);
  const [user, setUser] = useRecoilState(userAtom);
//url => code => access_token => local
useEffect(() => {
  async function fetchToken() {
    try {
      const token = await getAccessToken();
      console.log(token);
      setGHToken(token);
    } catch (error) {
      console.log('err: ',error)
    }
  }
  fetchToken()
},[])

const handleGHLogInServer = async (info) => {
  try {
    const payload = {
      name: info?.login,
      username: info?.login,
      email: info?.login+"@gmail.com",
      password: String(info?.id),
      profilePic: info?.avatar_url
    }

    console.log(payload)

    const res = await fetch("/api/user/login/github", {
      method: "POST",
      headers:{
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if(data.error) {
      console.log("Error In handleGHLogInServer",data.error);
      return;
    }
    
    localStorage.setItem("user-network", JSON.stringify(data));
    setUser(data)


  } catch (error) {
    console.error("Error in handle GH Login at Server",error)
  }
}

useEffect(() => {
  // console.log(user)
  if(GHToken !== null & user === null) {
    async function fetchUserDataAndLogin() {
      const data = await getUserData(GHToken)
      // console.log(data)
      handleGHLogInServer(data)
    }
    
    fetchUserDataAndLogin()
  }

  
}, [GHToken, setUser, user])


  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen">
        <img width="100" src={loader} alt="loader" />
        <p>Redirecting to homepage...</p>
      </div>

    </>
  );
};

export default Callback;