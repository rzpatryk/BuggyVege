const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const authRouter = require('./MongodbJWT/Routes/authRouter');
const productRouter = require('./MongodbJWT/Routes/productRouter');
const walletRouter = require('./MongodbJWT/Routes/walletRouter');
const reviewRouter = require('./MongodbJWT/Routes/reviewRouter');
const globalErrorHandler = require('./MongodbJWT/Controllers/errorController')

const authRouterMysql = require('./MysqlJWT/Routes/authRouter');
const productRouterMysql = require('./MysqlJWT/Routes/productRouter');
const walletRouterMysql = require('./MysqlJWT/Routes/walletRouter');
const reviewRouterMysql = require('./MysqlJWT/Routes/reviewRouter');

const authRouterMysqlSession = require('./MysqlSession/Routes/authRouter');
const productRouterMysqlSession = require('./MysqlSession/Routes/productRouter');
const walletRouterMysqlSession = require('./MysqlSession/Routes/walletRouter');
const reviewRouterMysqlSession = require('./MysqlSession/Routes/reviewRouter');

const testRoute = require('./TestRefactor/Routes/AuthRoute');

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
app.use('/api/v1/reviews', reviewRouter);

app.use('/api/v2/auth', authRouterMysql);
app.use('/api/v2/admin', productRouterMysql);
app.use('/api/v2/wallet', walletRouterMysql);
app.use('/api/v2/reviews', reviewRouterMysql);
app.use('/api/v3', session({
  secret: 'tajny_klucz_sesji',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Ustaw true jeśli używasz HTTPS
}));
app.use('/api/v3/auth', authRouterMysqlSession);
app.use('/api/v3/admin', productRouterMysqlSession);
app.use('/api/v3/wallet', walletRouterMysqlSession);
app.use('/api/v3/reviews', reviewRouterMysqlSession);

app.use('/api/v4', session({
  secret: 'tajny_klucz_sesji',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Ustaw true jeśli używasz HTTPS
}));
app.use('/api/v4/auth', testRoute);


app.use(globalErrorHandler);
module.exports = app;