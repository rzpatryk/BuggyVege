const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');
const authRouter = require('./Routes/authRouter');
const productRouter = require('./Routes/productRouter');
const walletRouter = require('./Routes/walletRouter');
const globalErrorHandler = require('./Controllers/errorController')

let app = express();


app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Serwuj statyczne pliki z folderu uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next)=>{
    req.requestedAt = new Date().toISOString();
    next();
});
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', productRouter);
app.use('/api/v1/wallet', walletRouter);
app.use(globalErrorHandler);
module.exports = app;