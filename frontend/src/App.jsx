import React from 'react'
import Index from "./Routes/Index"
import { Bounce, ToastContainer } from 'react-toastify';


function App() {

  return (
    <>
      <Index/>
      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </>


  )
}

export default App
