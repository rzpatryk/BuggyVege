const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const globalErrorHandler = require('./Controllers/ErrorControllers/errorController');

const mongoSessionRoutes = require('./Routes/MongoSessionRoutes');
const mongoJWTAuthRoute = require('./Routes/MongoJWTRoutes');

const mysqlSessionRoutes = require('./Routes/MysqlSessionRoutes');
const mysqlJWTAuthRoute = require('./Routes/MysqlJWTRoutes');
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


app.use('/api/v4', session({
  secret: 'tajny_klucz_sesji',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Ustaw true jeśli używasz HTTPS
}));
app.use('/api/v4/auth', mysqlSessionRoutes);

app.use('/api/v5', session({
  secret: 'tajny_klucz_sesji',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use('/api/v5/auth', mongoSessionRoutes); // MongoDB + Sessions

app.use('/api/v6/auth', mongoJWTAuthRoute); // MongoDB + JWT
app.use('/api/v7/auth', mysqlJWTAuthRoute); // MySQL + JWT (NOWY)
app.use(globalErrorHandler);
module.exports = app;