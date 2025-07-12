const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const authRouter = require('./Routes/authRouter');
const globalErrorHandler = require('./Controllers/errorController')

let app = express();


app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));
app.use((req, res, next)=>{
    req.requestedAt = new Date().toISOString();
    next();
});
app.use('/api/v1/auth', authRouter);
app.use(globalErrorHandler);
module.exports = app;