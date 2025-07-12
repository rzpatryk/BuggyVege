const User = require('./../Models/userModel');
const jwt = require('jsonwebtoken');
const asyncErrorHandler = require('./../Utils/asyncErrorHandler');
const CustomError = require('./../Utils/CustomError');

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