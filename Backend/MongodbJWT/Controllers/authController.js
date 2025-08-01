const User = require('./../Models/userModel');
const jwt = require('jsonwebtoken');
const asyncErrorHandler = require('./../../Utils/asyncErrorHandler');
const CustomError = require('./../../Utils/CustomError');

const signToken = id => {
    return jwt.sign({id}, process.env.SECRET_STR,{
            expiresIn: process.env.LOGIN_EXPIRES
        });
}
exports.signup = async(req, res)=>{
    try{
        const newUser = await User.create(req.body);

        const token = signToken(newUser._id);

        newUser.password = undefined;

        res.status(201).json({
            status: 'success',
            token,
            data:{
                user: newUser 
            }
        })
    }catch(err){
         res.status(400).json({
            status: 'fail',
            message: err.message
        })
        
    }
}

exports.login = asyncErrorHandler( async(req, res, next)=>{
    const email = req.body.email;
    const password = req.body.password;
    
    if(!email || !password){
        const error = new CustomError('Please provide email ID and password for login in!', 400);
        return next(error);
    }

    const user = await User.findOne({email}).select('+password');

    //const isMatch = await user.comparePasswordInDb(password, user.password);

    if(!user || !(await user.comparePasswordInDb(password, user.password))){
        const error = new CustomError('Incorrect email or password', 400);
        return next(error);
    }

    const token = signToken(user._id); 

    res.status(200).json({
            status: 'success',
            token,
            data:{
                user: user 
            }
    })
});

// Middleware do weryfikacji JWT token
exports.protect = asyncErrorHandler(async (req, res, next) => {
    // 1) Sprawdź czy token istnieje
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        const error = new CustomError('You are not logged in! Please log in to get access.', 401);
        return next(error);
    }

    // 2) Weryfikuj token
    const decoded = jwt.verify(token, process.env.SECRET_STR);

    // 3) Sprawdź czy użytkownik nadal istnieje
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        const error = new CustomError('The user belonging to this token no longer exists.', 401);
        return next(error);
    }

    // 4) Sprawdź czy hasło nie zostało zmienione po wydaniu tokenu
    if (await currentUser.isPasswordChanged(decoded.iat)) {
        const error = new CustomError('User recently changed password! Please log in again.', 401);
        return next(error);
    }

    // Przekaż użytkownika do następnego middleware
    req.user = currentUser;
    next();
});

// Middleware do autoryzacji ról
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            const error = new CustomError('You do not have permission to perform this action', 403);
            return next(error);
        }
        next();
    };
};

// Endpoint do sprawdzenia profilu użytkownika (chroniony)
exports.getProfile = asyncErrorHandler(async (req, res, next) => {
    res.status(200).json({
        status: 'success',
        data: {
            user: req.user
        }
    });
});