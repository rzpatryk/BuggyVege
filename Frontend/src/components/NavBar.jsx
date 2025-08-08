import {useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from "../assets/logo.png"
import search_icon from "../assets/search_icon.svg"
import cart_icon from "../assets/cart_icon.svg"
import profile_icon from "../assets/profile_icon.png"
import menu_icon from '../assets/menu_icon.svg'
import { useLoginContext } from '../context/LoginContext'
import { useNavigate } from "react-router-dom";


const Navbar = () => {
    const [open, setOpen] = useState(false)
    const {setShowUserLogin, user, setUser, role, setRole, mode} = useLoginContext();
    const navigate = useNavigate();

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
        }
    }
    return (
        <nav className="flex items-center justify-between px-6 md:px-16 lg:px-24 xl:px-32 py-4 border-b border-gray-300 bg-white relative transition-all">

            <NavLink to='/' onClick={() => setOpen(false)}>
                <img className="h-10" src={logo} alt="logo" />
             </NavLink>

            {/* Desktop Menu */}
            <div className="hidden sm:flex items-center gap-8">
                <NavLink to='/'>Home</NavLink>
                <NavLink to='/AllProducts'>All Products</NavLink>

                <div className="hidden lg:flex items-center text-sm gap-2 border border-gray-300 px-3 rounded-full">
                    <input className="py-1.5 w-full bg-transparent outline-none placeholder-gray-500" type="text" placeholder="Search products" />
                    <img src={search_icon} alt='search' className='w-4 h-4'/>
                </div>

                <div className="relative cursor-pointer">
                    <img src={cart_icon} alt='cart' className='w-6 opacity-80'/>
                    <button className="absolute -top-2 -right-3 text-xs text-white bg-primary 
                    w-[18px] h-[18px] rounded-full">3</button>
                </div>

               {!user ?(
                    <button onClick={()=>setShowUserLogin(true)} className="cursor-pointer px-8 py-2 bg-primary hover:bg-primary-dull transition text-white rounded-full">
                        Login
                    </button>)
                    :
                    (<div className='relative group'>
                        <img src={profile_icon} className='w-10' alt=""/>
                        <ul className='hidden group-hover:block absolute top-10 right-0 bg-white shadow border border-gray-200 py-2.5 w-30 rounded-md text-sm z-40'>
                            {role === "user" ? 
                                (<li  className='p-1.5 pl-3 hover:bg-primary/10 cursor-pointer'>My Orders</li>)
                            : role === "admin" ?
                                (<li  onClick={() => navigate('/AdminPanel')}className='p-1.5 pl-3 hover:bg-primary/10 cursor-pointer'>Admin Panel</li>)
                                : null
                            }
                            {/* <li  className='p-1.5 pl-3 hover:bg-primary/10 cursor-pointer'>My Orders</li> */}
                            <li onClick={logout} className='p-1.5 pl-3 hover:bg-primary/10 cursor-pointer'>Logout</li>
                        </ul>
                    </div>)
                }
            </div>

            <div className='flex items-center gap-6 sm:hidden'>
                <div  className="relative cursor-pointer">
                    <img src={cart_icon} alt='cart' className='w-6 opacity-80'/>
                    <button className="absolute -top-2 -right-3 text-xs text-white bg-primary 
                    w-[18px] h-[18px] rounded-full">3</button>
                </div>
                <button onClick={() => open ? setOpen(false) : setOpen(true)} aria-label="Menu" className="">
                    {/* Menu Icon SVG */}
                        <img src={menu_icon} alt='menu' />
                </button>
            </div>

            { open && (  
            /* Mobile Menu */
            <div className={`${open ? 'flex' : 'hidden'} absolute top-[60px] left-0 w-full bg-white shadow-md py-4 flex-col items-start gap-2 px-5 text-sm md:hidden`}>
                <NavLink to='/'>Home</NavLink>
                <NavLink to='/AllProducts'>All Products</NavLink>
                {false && 
                <NavLink to='/products' onClick={()=>setOpen(false)}>My Orders</NavLink>
                }

                {!user ? (
                    <button onClick={()=>{
                        setOpen(false)
                        setShowUserLogin(true)
                    }}className="cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                        Login
                        </button>
                ) : (
                    <button onClick={logout} className="cursor-pointer px-6 py-2 mt-2 bg-primary hover:bg-primary-dull transition text-white rounded-full text-sm">
                        Logout
                        </button>
                )}
            
               
            </div>
            )}

        </nav>
    )
}

export default Navbar