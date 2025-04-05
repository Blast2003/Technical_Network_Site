import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import { SocketContextProvider } from './Context/SocketContext.jsx'

import { GoogleOAuthProvider } from '@react-oauth/google';

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <RecoilRoot>
          <BrowserRouter>
              <SocketContextProvider>
              <GoogleOAuthProvider clientId={import.meta.env.VITE_GG_CLIENT_ID}>
                <App />
              </GoogleOAuthProvider>
              </SocketContextProvider>
          </BrowserRouter>
      </RecoilRoot>
    
  </StrictMode>,
)
