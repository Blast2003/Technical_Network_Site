import React from 'react'
import { Navigate, Route, Routes } from "react-router-dom"
import DefaultPage from "../Pages/DefaultPage"
import HomePage from "../Pages/HomePage"
import UserProfilePage from "../Pages/UserProfilePage"
import SignUpPage from "../Pages/SignUpPage"
import SignInPage from "../Pages/SignInPage"
import SpecificPostPage from "../Pages/SpecificPostPage"
import UpdateUserProfilePage from "../Pages/UpdateUserProfilePage"
import FreezeAccountPage from "../Pages/FreezeAccountPage"
import ChatPage from "../Pages/ChatPage"
import { useRecoilValue } from 'recoil'
import userAtom from '../Atoms/userAtom'
import SearchResults from '../Pages/SearchResults'
import FollowingUsers from '../Pages/FollowingUsers'
import RecruitmentPage from '../Pages/RecruitmentPage'
import Callback from '../Pages/CallBack'
import NotFoundPage from '../Pages/NotFoundPage'
import Career_Paths from '../Pages/Career_Paths'

const Index = () => {
  const user = useRecoilValue(userAtom)
  console.log(user)

  return (
    <>
        <Routes>
        <Route path="/tech" element={<DefaultPage/>}>
          <Route index element={user ? <HomePage/> : <Navigate to="/signin"/>} />
          <Route path='recruitment' element={user ? <RecruitmentPage/> : <Navigate to="/signin"/>} />

          <Route path="profile/:username"  element={<UserProfilePage/>} />

          {/* <Route path="post/:username/:id" element={user ? <SpecificPostPage/> : <Navigate to="/signin"/>}/> */}
          <Route path="updateProfile/:id"  element={user ? <UpdateUserProfilePage/> : <Navigate to="/signin"/>} />
          <Route path="search" element={user ? <SearchResults/> : <Navigate to="/signin"/> }/>
          <Route path="following" element={user ? <FollowingUsers/> : <Navigate to="/signin"/> }/>
          <Route path="freeze" element={user ? <FreezeAccountPage/> : <Navigate to="/signin"/>}/>
          <Route path="chat" element={user ? <ChatPage/> : <Navigate to="/signin"/>}/>
          <Route path="career-paths" element={user ? <Career_Paths/> : <Navigate to="/signin"/>}/>
        </Route>

          <Route path="/" element={user ? <Navigate to="/tech"/> : <Navigate to="/signin"/>}/>
          <Route path="/signup" element={user ? <Navigate to="/tech"/> : <SignUpPage/>}/>
          <Route path="/signin" element={user ? <Navigate to="/tech"/> : <SignInPage/>}/>
          <Route path="/callback"  element={user? <Navigate to="/tech"/> : <Callback/>} />

          {/* Catch all unmatched top-level routes */}
          <Route path="*" element={<NotFoundPage />} />
    
      </Routes>
    </>
  )
}

export default Index