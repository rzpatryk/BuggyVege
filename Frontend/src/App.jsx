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
import AuthForm from './components/AuthComponents/AuthForm'

const endpoints = {
  MysqlJWT:{
    loginUrl: 'http://localhost:3000/api/v7/auth/login',
    registerUrl: 'http://localhost:3000/api/v7/auth/register',
    forgotPasswordUrl: 'http://localhost:3000/api/v7/auth/forgot-password',
    resetPasswordUrl: 'http://localhost:3000/api/v7/auth/reset-password',
    fetchOptions: {
      headers: {
        'Content-Type': 'application/json',
      }
    }
  },
    MysqlSession:{
      loginUrl: 'http://localhost:3000/api/v4/auth/login',
      registerUrl: 'http://localhost:3000/api/v4/auth/register',
      forgotPasswordUrl: 'http://localhost:3000/api/v4/auth/forgot-password',
      resetPasswordUrl: 'http://localhost:3000/api/v4/auth/reset-password',
      fetchOptions: {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    },
      MongoJWT:{
        loginUrl: 'http://localhost:3000/api/v6/auth/login',
        registerUrl: 'http://localhost:3000/api/v6/auth/register',
        forgotPasswordUrl: 'http://localhost:3000/api/v6/auth/forgot-password',
        resetPasswordUrl: 'http://localhost:3000/api/v6/auth/reset-password',
        fetchOptions: {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      },
      MongoSession:{
        loginUrl: 'http://localhost:3000/api/v5/auth/login',
        registerUrl: 'http://localhost:3000/api/v5/auth/register',
        forgotPasswordUrl: 'http://localhost:3000/api/v5/auth/forgot-password',
        resetPasswordUrl: 'http://localhost:3000/api/v5/auth/reset-password',
        fetchOptions: {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      }
    }


const App = () => {
  const {showUserLogin, role,mode} = useLoginContext();
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
      {showUserLogin ? <AuthForm 
      loginUrl={endpoints[mode].loginUrl}
      registerUrl={endpoints[mode].registerUrl}
      fetchOptions={endpoints[mode].fetchOptions}
      forgotPasswordUrl={endpoints[mode].forgotPasswordUrl}
      resetPasswordUrl={endpoints[mode].resetPasswordUrl}
      /> : null}
      <RouterProvider router={router}/>
    </div>
    
  )
}

export default App