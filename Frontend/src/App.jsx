import React from 'react'
import Navbar from './components/NavBar'
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
import AuthForm from './components/AuthComponents/AuthForm'

const endpointsAuth = {
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
    const endpointsProducts= {
      MongoJWT:{
        addProductUrl: 'http://localhost:3000/api/v6/auth/addProducts',
        fetchOptions: {
          headers: {
            
          }
        }
      },
      MongoSession:{
        addProductUrl: 'http://localhost:3000/api/v5/auth/addProducts',
        fetchOptions: {
          credentials: 'include',
        }
      },
      MysqlJWT:{
        addProductUrl: 'http://localhost:3000/api/v7/auth/addProducts',
        fetchOptions: {
        headers: {
          
        }
      }
    },
      MysqlSession:{
        addProductUrl: 'http://localhost:3000/api/v4/auth/addProducts',
        fetchOptions: {
        credentials: 'include'
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
          <Route path="AddProduct" element={<AddProduct
          addProductUrl={endpointsProducts[mode].addProductUrl}
          fetchOptions={endpointsProducts[mode].fetchOptions}
          />}/>
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
      loginUrl={endpointsAuth[mode].loginUrl}
      registerUrl={endpointsAuth[mode].registerUrl}
      fetchOptions={endpointsAuth[mode].fetchOptions}
      forgotPasswordUrl={endpointsAuth[mode].forgotPasswordUrl}
      resetPasswordUrl={endpointsAuth[mode].resetPasswordUrl}
      /> : null}
      <RouterProvider router={router}/>
    </div>
    
  )
}

export default App