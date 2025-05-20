// src/Callback/Callback.jsx
import { useRecoilState } from 'recoil';
import loader from '../assets/loader.svg';
import { useEffect } from 'react';
import ghTokenAtom from '../Atoms/ghTokenAtom';
import userAtom from '../Atoms/userAtom';

const Callback = () => {
  const [GHToken, setGHToken] = useRecoilState(ghTokenAtom);
  const [user, setUser] = useRecoilState(userAtom);

  // send GitHub code to our backend, get back access_token + user info
  useEffect(() => {
    async function handleGithubCallback() {
      const code = new URLSearchParams(window.location.search).get('code');
      if (!code) {
        console.error('No code in query string');
        return;
      }

      try {
        // 1) Exchange code for token + GitHub profile on our server
        const resp = await fetch('/api/auth/github/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const githubData = await resp.json();
        if (githubData.error) {
          console.error('GitHub callback error:', githubData.error);
          return;
        }

        const { access_token, login, id, avatar_url } = githubData;
        setGHToken(access_token);

        // 2) Now log in/register on our own API
        const payload = {
          name:       login,
          username:   login,
          email:      `${login}@gmail.com`,
          password:   String(id),
          profilePic: avatar_url,
        };

        const loginRes = await fetch('/api/user/login/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const appData = await loginRes.json();

        if (appData.error) {
          console.error('Error in handleGHLogInServer:', appData.error);
          return;
        }

        localStorage.setItem('user-network', JSON.stringify(appData));
        setUser(appData);

      } catch (err) {
        console.error('Callback processing error:', err);
      }
    }

    handleGithubCallback();
  }, [setGHToken, setUser]);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <img width="100" src={loader} alt="loader" />
      <p>Redirecting to homepage...</p>
    </div>
  );
};

export default Callback;
