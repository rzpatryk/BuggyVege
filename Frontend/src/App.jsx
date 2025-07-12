import React from 'react'
import Navbar from './components/NavBar'
import Login from './components/Login'
import { Routes, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom'
import Home from './pages/Home'
import AllProducts from './pages/AllProducts'
import RootLayout from './layout/RootLayout'
import { useLoginContext } from './context/LoginContext'

const App = () => {
  const {showUserLogin} = useLoginContext();
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path='/' element={<RootLayout/>}>
        <Route index element={<Home/>}/>
        <Route path='AllProducts' element={<AllProducts/>}/>
      </Route>
    )
  )

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>
      {showUserLogin ? <Login/> : null}
      <RouterProvider router={router}/>
    </div>
    
  )
}

export default App