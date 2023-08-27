const AppError = require('../utils/appError');
const Tour = require('./../models/tourModel');
const User = require('./../models/userModel');
const Booking = require('./../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res, next) => {
    //1) Get tour data from collection
    const tours = await Tour.find();
    //2) Build Template

    //3) Render that template with the data collected from 1)

    res.status(200).render('overview', {
        Title: 'All tours',
        tours
    });
});
exports.getTour = catchAsync(async (req, res, next) => {
    const tour = await Tour.findOne({ slug: req.params.slug }).populate({
        path: 'reviews',
        fields: 'review rating user'
    });

    if (!tour) {
        return next(new AppError('There is no tour with that name.', 404));
    }
    res
        .status(200)
        .set(
            'Content-Security-Policy',
            "default-src 'self' https://*.mapbox.com ;base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src https://cdnjs.cloudflare.com https://api.mapbox.com 'self' blob: ;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests;"
        )
        .render('tour', {
            Title: `${tour.name} Tour`,
            tour
        });
});

exports.getLoginForm = (req, res) => {
    res
        .status(200)
        .set(
            'Content-Security-Policy',
            "script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/axios/1.4.0/axios.min.js 'unsafe-inline' 'unsafe-eval';"
        )
        .render('login', {
            title: 'Log in to your accounts'
        });
};
exports.getSignupForm = (req, res) => {
    res
        .status(200)
        .set(
            'Content-Security-Policy',
            "connect-src 'self' https://cdnjs.cloudflare.com"
        )
        .render('signup', {
            title: 'Create a new account.'
        });
};
exports.getAccount = (req, res) => {
    res.status(200).render('account', {
        title: 'Have a look at your account.'
    });
};

exports.getMyTours = catchAsync(async (req, res, next) => {

    //1) Find all bookings
    const bookings = await Booking.find({ user: req.user.id })
    //2) Find tours with the returned IDs
    const tourIDs = bookings.map(el => el.tour);
    const tours = await Tour.find({ _id: { $in: tourIDs } });

    res.status(200).render('overview', {
        title: 'My Tours',
        tours
    })
});

exports.updateUserData = catchAsync(async (req, res, next) => {
    console.log('UPDATING USER', req.body);
    const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        {
            name: req.body.name,
            email: req.body.email
        },
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).render('account', {
        title: 'Have a look at your account.',
        user: updatedUser
    });
});
