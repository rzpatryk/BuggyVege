import React, { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import add_icon from "../../assets/add_icon.svg"
import product_list_icon from "../../assets/product_list_icon.svg"
import order_icon from "../../assets/order_icon.svg"
import logo from "../../assets/logo.png"
import { useLoginContext } from '../../context/LoginContext';

const AdminPanel = () => {
const navigate = useNavigate();


const {setHiddenNavBar, setUser,setRole, mode } = useLoginContext();
  useEffect(() => {
    setHiddenNavBar(true);
  }, []);
  const sidebarLinks = [
        { name: "Add Product", path: "/AdminPanel/AddProduct", icon: add_icon },
        { name: "Product List", path: "/AdminPanel/ProductsList", icon: product_list_icon },
        { name: "Orders", path: "/AdminPanel/Orders", icon: order_icon },
    ];

const logout = async () =>
    {
        if(mode === "MongoJWT"){
            const response = await fetch('http://localhost:3000/api/v6/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            console.log(response.message);
            setUser(null);
            setRole(null);
            navigate("/");
            localStorage.removeItem("token");
        }else if(mode === "MongoSession"){
            const response = await fetch('http://localhost:3000/api/v5/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log(response.message);
            setUser(null);
            setRole(null);
            navigate("/");
        }else if(mode === "MysqlSession"){
            const response = await fetch('http://localhost:3000/api/v4/auth/logout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log(response.message);
            setUser(null);
            setRole(null);
            navigate("/");
        }else if(mode === "MysqlJWT"){
            const response = await fetch('http://localhost:3000/api/v7/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log(response.message);
            setUser(null);
            setRole(null);
            navigate("/");
            localStorage.removeItem("token");
        }
    }

  return (
    <>
            <div className="flex items-center justify-between px-4 md:px-8 border-b border-gray-300 py-3 bg-white">
                <Link to='/'>
                    <img src={logo} alt="logo" className="cursor-pointer w-34 md:w-38"/>
                </Link>
                <div className="flex items-center gap-5 text-gray-500">
                    <p>Hi! Admin</p>
                    <button onClick={logout} className='border rounded-full text-sm px-4 py-1'>Logout</button>
                </div>
            </div>
            <div className="flex">
                <div className="md:w-64 w-16 border-r h-[550px] text-base border-gray-300 pt-4 flex flex-col transition-all duration-300">
                {sidebarLinks.map((item) => (
                    <NavLink to={item.path} key={item.name} end={item.path === "/AdminPanel"}
                        className={({isActive})=>`flex items-center py-3 px-4 gap-3 
                            ${isActive ? "border-r-4 md:border-r-[6px] bg-primary/10 border-primary text-primary"
                                : "hover:bg-gray-100/90 border-white"
                            }`
                        }
                    >
                        <img src={item.icon} alt="" className="w-7 h-7"/>
                        <p className="md:block hidden text-center">{item.name}</p>
                    </NavLink>
                ))}
            </div>
            <Outlet/>
            </div>
            
        </>
  )
}

export default AdminPanel