/* eslint-disable*/
import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async tourId => {
    const stripe = Stripe('pk_test_51Nja35SInAhFqGMsltY5NnLkGNaEHbfko7YOWlM5WgrjBuW298q2AD7ZXtNRQzvzymjTvxk1Xvs0yUFR7uboVLzI003xgv1ypg');
    try {
        //1) Get checkout session from API
        const session = await axios(`http://127.0.0.1:3000/api/v1/booking/checkout-session/${tourId}`);
        console.log(session);
        //2) Create checkout form + charge credit card
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id
        }
        )
    } catch (err) {
        console.log(err);
        showAlert('error', err);
    }

};