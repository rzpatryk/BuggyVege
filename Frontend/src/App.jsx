import React from 'react'
import Navbar from './components/NavBar'
import LoginJWTMongo from './components/AuthComponents/LoginJWTMongo'
import LoginSessionMongo from './components/AuthComponents/LoginSessionMongo'
import { Routes, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom'
import Home from './pages/Home'
import AllProducts from './pages/AllProducts'
import RootLayout from './layout/RootLayout'
import { useLoginContext } from './context/LoginContext'
import AdminPanel from './pages/AdminPanel/AdminPanel'
import AddProduct from './pages/AdminPanel/AddProduct'
import UsersList from './pages/AdminPanel/UsersList'
import ProductsList from './pages/AdminPanel/ProductsList'
import Orders from './pages/AdminPanel/Orders'
import LoginSessionMysql from './components/AuthComponents/LoginSessionMysql'
import LoginJWTMysql from './components/AuthComponents/LoginJWTMysql'

const App = () => {
  const {showUserLogin, role} = useLoginContext();
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path='/' element={<RootLayout/>}>
        <Route index element={<Home/>}/>
        <Route path='AllProducts' element={<AllProducts/>}/>
        <Route path="AdminPanel" element={<AdminPanel/>}>
          <Route path="AddProduct" element={<AddProduct/>}/>
          <Route path="UserList" element={<UsersList/>}/>
          <Route path="ProductsList" element={<ProductsList/>}/>
          <Route path="Orders" element={<Orders/>}/>
        </Route>
      </Route>
    )
  )

  return (
    <div className='text-default min-h-screen text-gray-700 bg-white'>
      {showUserLogin ? <LoginJWTMysql/> : null}
      <RouterProvider router={router}/>
    </div>
    
  )
}

export default App