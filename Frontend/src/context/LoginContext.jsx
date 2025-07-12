import { createContext, useContext, useState } from "react";


export const LoginContext = createContext();

export const LoginContextProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [role, setRole] = useState(null);
    const [hiddenNavBar, setHiddenNavBar] = useState(false);



     const value = {showUserLogin, setShowUserLogin, role, setRole, user, setUser, hiddenNavBar, setHiddenNavBar};

     return <LoginContext.Provider value={value}>
        {children}
     </LoginContext.Provider>
}

export const useLoginContext = () => {
    return useContext(LoginContext);
}