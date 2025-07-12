import { createContext, useContext, useState } from "react";


export const LoginContext = createContext();

export const LoginContextProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [role, setRole] = useState(null);


     const value = {showUserLogin, setShowUserLogin, role, setRole, user, setUser};

     return <LoginContext.Provider value={value}>
        {children}
     </LoginContext.Provider>
}

export const useLoginContext = () => {
    return useContext(LoginContext);
}