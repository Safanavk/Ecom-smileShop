// DB configuration
require('dotenv').config();
require('./config/dbconnection');

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const cors = require('cors')
const {engine} = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const passport = require('./config/passport-config');
const{checkUserStatus} = require('./middlewares/auth')
const app = express();
const PORT = process.env.APP_PORT;
const morgan = require('morgan');




// Routes
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/adminRoutes');
const nocache = require('nocache');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(nocache());
app.use(express.static('public'));
app.use(morgan("dev"));


// Sessions
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 72 * 60 * 60 * 1000, // 72 hours
        httpOnly: true
    }
}));

// Google authentication using Passport
app.use(passport.initialize());
app.use(passport.session());


// Flash
app.use(flash());
app.use(cors())

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    res.locals.admin = req.session.admin || null;
    next();
});



// Express handlebars
app.engine('hbs', engine({
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views/layout/'),
    partialsDir: path.join(__dirname, 'views/partials/'),
    handlebars: Handlebars, // Use the Handlebars instance with registered helpers
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
    }
}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');



// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
        case '==':
            return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
            return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
            return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
            return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
            return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
            return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
            return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
            return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
            return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
            return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
            return options.inverse(this);
    }
});

Handlebars.registerHelper('or', function (v1, v2) {
    return v1 || v2;
});

Handlebars.registerHelper('add', function (a, b) {
    return a + b;
});

Handlebars.registerHelper('subtract', function (a, b) {
    return a - b;
});

Handlebars.registerHelper('range', function(start, end) {
    const range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
});

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});

Handlebars.registerHelper('lt', function(a, b) {
    return a < b;
});

Handlebars.registerHelper('multiply', function (a, b) {
    return a * b;
});

Handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context);
});

Handlebars.registerHelper('increment', function (value) {
    return parseInt(value) + 1;
});
Handlebars.registerHelper('formatDate', function (date) {
    return new Date(date).toLocaleDateString('en-GB', {
        day: 'numeric', 
        month: 'short', 
        year: 'numeric'
    });
});

// Routes should be registered after the middlewares
app.use('/',checkUserStatus, userRoutes);
app.use('/admin', adminRoutes);
app.get('*', (req,res)=>{
    res.redirect("/pagenotfound")
})

app.listen(PORT, () => {
    console.log(`The server is starting on http://localhost:${PORT}`);
});





