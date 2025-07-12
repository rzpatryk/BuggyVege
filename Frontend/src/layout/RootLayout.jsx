import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/NavBar'
import { useLoginContext } from '../context/LoginContext';

const RootLayout = () => {

  const {hiddenNavBar} = useLoginContext();
  return (
    <div>
       {hiddenNavBar ? null : <Navbar/>}
       {/* <Navbar/> */}
       <Outlet/>
    </div>
  )
}

export default RootLayout