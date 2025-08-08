import React, { useState } from 'react'
import { useLoginContext } from '../../context/LoginContext';
    


const LoginSessionMysql = () => {

    const {setShowUserLogin, setUser, setRole} = useLoginContext();
    const [state, setState] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [postResponse, setPostResponse] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false); 


     const handleSubmitLogin = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setPostResponse(null);

         try{
            const response = await fetch('http://localhost:3000/api/v4/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type' : 'application/json'
                },
                body: JSON.stringify({
                    "email": email,
                    "password": password
                })
            });
            if(!response.ok){
                const errorData = await response.json(); // Spróbuj sparsować jako JSON
                console.error('Błąd z serwera:', errorData);
                throw new Error(`HTTP error! status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            setPostResponse(data);
            console.log(data);
            setShowUserLogin(false);
            //localStorage.setItem("token", data.token);
            setUser({
                email: email,
                name: name

            })
            setRole(data.data.user.role)
            console.log(data.data.user.role);

        }catch(error){
            setError(error);
        }finally{
            setLoading(false);
        }


     }
     const handleSubmitRegister = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setPostResponse(null);

        try{
            const response = await fetch('http://localhost:3000/api/v4/auth/register', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type' : 'application/json'
                },
                body: JSON.stringify({
                    "name": name,
                    "email": email,
                    "password": password,
                    "confirmPassword": confirmPassword
                })
            });
            if(!response.ok){
                const errorData = await response.json(); // Spróbuj sparsować jako JSON
                console.error('Błąd z serwera:', errorData);
                throw new Error(`HTTP error! status: ${response.status}, Details: ${JSON.stringify(errorData)}`);
            }
            const data = await response.json();
            setPostResponse(data);
            console.log(data);
            setShowUserLogin(false);
            //localStorage.setItem("token", data.token);
            setUser({
                email: email,
                name: name

            })
            setRole(data.data.user.role)
        }catch(error){
            setError(error);
        }finally{
            setLoading(false);
        }
     };

  return (
    <div onClick={()=>setShowUserLogin(false)} className='fixed top-0 bottom-0 left-0 right-0 z-30 flex items-center
     text-sm text-gray-600 bg-black/50'>
        <form onSubmit={state === "register" ? handleSubmitRegister : handleSubmitLogin} onClick={(e)=>e.stopPropagation()}className="flex flex-col gap-4 m-auto items-start p-8 py-12 w-80 sm:w-[352px] rounded-lg shadow-xl border border-gray-200 bg-white">
            <p className="text-2xl font-medium m-auto">
                <span className="text-primary">User</span> {state === "login" ? "Login" : "Sign Up"}
            </p>
            {state === "register" && (
                <div className="w-full">
                    <p>Name</p>
                    <input onChange={(e) => setName(e.target.value)} value={name} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="text" required />
                </div>
            )}
            <div className="w-full ">
                <p>Email</p>
                <input onChange={(e) => setEmail(e.target.value)} value={email} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="email" required />
            </div>
            <div className="w-full ">
                <p>Password</p>
                <input onChange={(e) => setPassword(e.target.value)} value={password} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="password" required />
            </div>
            {state === "register" && (
                <div className="w-full ">
                    <p>Confirm Password</p>
                    <input onChange={(e) => setConfirmPassword(e.target.value)} value={confirmPassword} placeholder="type here" className="border border-gray-200 rounded w-full p-2 mt-1 outline-primary" type="password" required />
                </div>
            )}
            {state === "register" ? (
                <p>
                    Already have account? <span onClick={() => setState("login")} className="text-primary cursor-pointer">click here</span>
                
                </p>
            ) : (
                <div>
                    <p>
                        Create an account? <span onClick={() => setState("register")} className="text-primary cursor-pointer">click here</span>
                    </p>
                    <p>
                        Forgot password? <span /*onClick={() => setState("register")}*/ className="text-primary cursor-pointer">click here</span>
                    </p>
                </div>
            )}
            <button className="bg-primary hover:bg-primary-dull transition-all text-white w-full py-2 rounded-md cursor-pointer">
                {state === "register" ? "Create Account" : "Login"}
            </button>
        </form>
     </div>
  )
}

export default LoginSessionMysql