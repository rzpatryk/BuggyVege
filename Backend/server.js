const mongoose = require('mongoose');
const app = require("./app");
const dotenv = require('dotenv');
dotenv.config({path: './config.env'});
const { testConnection } = require('./database');
mongoose.connect("mongodb://localhost:27017/BuggyVege").then((conn)=>{
    //console.log(conn);
    console.log('DB Connection Successful');
    
}).catch((error)=>{
    console.log("Some error has occured");
    
})
mongoose.connection.once('open', () => {
  console.log('👀 Połączono z bazą:', mongoose.connection.name);
});
testConnection();
const port = 3000;
app.listen(port, () => {
    console.log('server has started...');
})