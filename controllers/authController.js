const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const User = require('./../models/userModel');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};
const createAndSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true
    };
    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
    res.cookie('jwt', token, cookieOptions);

    //removes password from showing up in query from API
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });
};
exports.signUp = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        passwordChangedAt: req.body.passwordChangedAt,
        role: req.body.role,
        active: req.body.active
    });
    const url = `${req.protocol}://${req.get('host')}/me`;
    console.log(url);
    await new Email(newUser, url).sendWelcome();
    createAndSendToken(newUser, 201, res);
});
exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;
    //1) Check if email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }
    //2) Check if user exists and the password is correct
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password!', 401));
    }
    //3) If everything is ok, send token to client
    createAndSendToken(user, 200, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({
        status: 'success'
    });
};
exports.protect = catchAsync(async (req, res, next) => {
    //1) Get token and check if it's there
    let token;
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    // console.log(token);
    if (!token) {
        return next(
            new AppError('You are not logged in. PLease login to get access.', 401)
        );
    }
    //2} Verification of token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    // console.log(decoded);
    //3)Check if the user still exists
    const freshUser = await User.findById(decoded.id);
    if (!freshUser) {
        return next(
            new AppError('The user belonging to this token no longer exists.', 401)
        );
    }
    //4)Check if the user changed password after the token was issued
    if (freshUser.changedPasswordAfter(decoded.iat)) {
        return next(
            new AppError('User recently changed password. Please log in again!', 401)
        );
    }
    req.user = freshUser;
    res.locals.user = freshUser;
    next();
});

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
    try {
        if (req.cookies.jwt) {
            //1) Verify the token
            const decoded = await promisify(jwt.verify)(
                req.cookies.jwt,
                process.env.JWT_SECRET
            );

            //3)Check if the user still exists
            const freshUser = await User.findById(decoded.id);
            if (!freshUser) {
                return next();
            }
            //4)Check if the user changed password after the token was issued
            if (freshUser.changedPasswordAfter(decoded.iat)) {
                return next();
            }

            //THERE IS A LOGGED IN USER
            res.locals.user = freshUser;
            return next();
        }
        next();
    } catch (err) {
        return next();
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission to perform this action!', 403)
            );
        }
        next();
    };
};
exports.forgotPassword = catchAsync(async (req, res, next) => {
    //1) Get user ID based on the posted email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(new AppError('There is no user with this email address.', 404));
    }
    //2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });
    //3) Send it to the user's email

    try {
        const resetURL = `${req.protocol}://${req.get(
            'host'
        )}/api/v1/users/resetPassword/${resetToken}`;

        await new Email(user, resetURL).sendPasswordReset();
        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(
            new AppError(
                'There was an error sending the email. Try again later!',
                500
            )
        );
    }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
    //1) Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });
    //2)If the token has not expired, and there is a user, then change the password
    if (!user) {
        return next(new AppError('Token is invalid or has expired.', 400));
    }
    user.password = req.body.password;
    user.confirmPassword = req.body.confirmPassword;
    user.resetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    //3)Update passwordChangedAt property for the user

    //4)Log the user in, send JWT
    createAndSendToken(user, 200, res);
});
exports.updatePassword = catchAsync(async (req, res, next) => {
    //1) Get user from the collection
    const user = await User.findById(req.user.id).select('+password');
    //2) Check if the current POSTed password is correct
    if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
        return next(
            new AppError(
                'The password you entered does not match the current password!',
                401
            )
        );
    }
    //3) If so, update the password
    user.password = req.body.password;
    user.confirmPassword = req.body.confirmPassword;
    await user.save();
    //4) Log the user in, send JWT
    createAndSendToken(user, 200, res);
});
