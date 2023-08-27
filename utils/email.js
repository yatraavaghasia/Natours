const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');
// new Email(user, url).sendWelcome();

module.exports = class Email {
    constructor(user, url) {
        this.to = user.email;
        this.firstName = user.name.split(' ')[0];
        this.url = url;
        this.from = `Yatra Vaghasia <${process.env.EMAIL_FROM}>`;
    }

    newTransport() {
        if (process.env.NODE_ENV === 'production') {
            // Sendgrid
            return 1;
        }

        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    //Send the actual mail
    async send(template, subject) {
        //1) render the teampplate based on a pug file
        const html = pug.renderFile(
            `${__dirname}/../views/emails/${template}.pug`,
            {
                firstName: this.firstName,
                url: this.url,
                subject
            }
        );
        //2)Define the email options
        const mailOptions = {
            from: this.from,
            to: this.to,
            subject,
            html,
            text: convert(html)
        };

        //3) Create a transport and send email

        await this.newTransport().sendMail(mailOptions);
    }

    async sendWelcome() {
        await this.send('welcome', 'Welcome to the Natours Family!');
    }

    async sendPasswordReset() {
        await this.send(
            'passwordReset',
            'Your password reset token. (Valid for only 10 minutes)'
        );
    }
};
