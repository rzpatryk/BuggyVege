import { useState } from 'react';
import { useLoginContext } from '../../context/LoginContext';
export function useAuthForm({ loginUrl, registerUrl, fetchOptions, forgotPasswordUrl, resetPasswordUrl }) {
  const [state, setState] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [postResponse, setPostResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const {setShowUserLogin, setUser, setRole, mode} = useLoginContext();

  const handleSubmitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPostResponse(null);
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        ...fetchOptions,
        body: JSON.stringify({ 
          "email": email,
          "password": password
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }
      const data = await response.json();
      setPostResponse(data);
      setShowUserLogin(false);
      setUser({
                email: email,
                name: name

            })
      setRole(data.data.user.role)
      if(mode=== "MongoJWT" || mode=== "MysqlJWT"){
        localStorage.setItem("token", data.token);
      }
      return data;
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRegister = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPostResponse(null);
    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        ...fetchOptions,
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }
      const data = await response.json();
      setPostResponse(data);
      setShowUserLogin(false);
      return data;
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPostResponse(null);
    try{
      const response = await fetch(forgotPasswordUrl, {
        method: 'POST',
        ...fetchOptions,
        body: JSON.stringify({ 
          "email": email
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }
      const data = await response.json();
      console.log(data);
      const response2 = await fetch(resetPasswordUrl, {
        method: 'PATCH',
        ...fetchOptions,
        body: JSON.stringify({ 
          "token": data.resetToken,
          "newPassword": password,
          "confirmPassword": confirmPassword
        }),
      });
      if (!response2.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }
      const data2 = await response2.json();
      setPostResponse(data2);
      console.log(data2);
      setShowUserLogin(false);
      return data2;
    }catch (error) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    state, setState, name, setName, email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
    postResponse, error, loading, handleSubmitLogin, handleSubmitRegister, handleForgotPassword
  };
}