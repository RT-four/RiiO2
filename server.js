const express = require("express");
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const passport = require("passport");
const flash = require("express-flash");
require("sequelize")
const session = require("express-session");
require("dotenv").config();
const app = express();

const https = require('https')
const path = require('path')
const fs = require('fs')

var server = require('http').createServer(app);  
var io = require('socket.io')(server);

const PORT = process.env.PORT || 3000;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" 

const initializePassport = require("./passportConfig");

initializePassport(passport);

app.use(express.static(__dirname + '/public'));

// Middleware

// Parses details from a form
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");


// if (process.env.DATABASE_URL) {
//   // the application is executed on Heroku ... use the postgres database
//   sequelize = new Sequelize(process.env.DATABASE_URL, {
//     dialect:  'postgres',
//     protocol: 'postgres',
//     logging:  true //false
//   });
// } else {
//   // the application is executed on the local machine
//   sequelize = new Sequelize("postgres:///my_db");
// }

app.use(
  session({
    // Key we want to keep secret which will encrypt all of our information
    secret: process.env.SESSION_SECRET,
    // Should we resave our session variables if nothing has changes which we dont
    resave: false,
    // Save empty value if there is no vaue which we do not want to do
    saveUninitialized: false
  })
);
// Funtion inside passport which initializes passport
app.use(passport.initialize());
// Store our variables to be persisted across the whole session. Works with app.use(Session) above
app.use(passport.session());
app.use(flash());


let posts = [];
// const sslServer = https.createServer(
//   {
//   key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')), 
//   cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))
// },
//  app)
// app.get("/", (req, res) => {
//   res.sendFile(__dirname + "/public/frontend/index.html");
// });


// server.listen(5000, function () {
//   console.log('Server listening at port %d', 5000);
// });

// const opts = {
//   key: fs.readFileSync('privateKey.pem'),
//   cert: fs.readFileSync('certificate.pem')
// }
// var httpsServer = https.createServer(opts, app);
// httpsServer.listen(5001, function(){
//   console.log("HTTPS on port " + 5001);
// })


// var port = 8000;

// var options = {
//     key: fs.readFileSync('privateKey.pem'),
//     cert: fs.readFileSync('certificate.pem'),
// };

// var server = https.createServer(options, app).listen(port, function(){
//   console.log("Express server listening on port " + port);
// });

app.get("/", (req, res) => {
  res.render("main");  
});

app.get("/frontend/registration", (req, res) => {
  res.render("index");  
});


app.get("/compose", function(req, res){
  res.render("compose");
});

app.post("/compose", function(req, res){
  const post = {
    title: req.body.postTitle,
    content: req.body.postBody
  };

  posts.push(post);

  res.redirect("/");

});

app.get("/registration", (req, res) => {
  res.render("login");  
});

app.get("/users/registration", (req, res) => {
  res.render("login");  
});

app.get("/users/index", (req, res) => {
  res.render("index");  
});

app.get("/users/register", checkAuthenticated, (req, res) => {
  res.render("register.ejs");
});

app.get("/users/login", checkAuthenticated, (req, res) => {
  // flash sets a messages variable. passport sets the error message
  console.log(req.session.flash.error);
  res.render("login.ejs");
});

app.get("/users/dashboard", checkNotAuthenticated, (req, res) => {
  console.log(req.isAuthenticated());
  res.render("dashboard", { user: req.user.name, posts: posts });
});

app.get("/users/logout", (req, res) => {
  req.logout();
  res.render("index", { message: "You have logged out successfully" });
});

app.get("/admin", (req, res) => {
  res.render("admin");
});

app.post("/users/admin", async (req, res) => {
  let { name, email, status, group, password, password2 } = req.body;

  let errors = [];

  console.log({
    name,
    email,
    status,
    group,
    password,
    password2

  });

  if (!name || !email || !status || !group || !password || !password2 ) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("admin");
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    // Validation passed
    pool.query(
      `SELECT * FROM users
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.log(err);
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          return res.render("register", {
            message: "Email already registered"
          });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password, status, group)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, password`,
            [name, email, hashedPassword, status, group],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success_msg", "Новый пользователь добавлен!");
              res.redirect("/users/login");
            }
          );
        }
      }
    );
  }
});

app.post("/users/register", async (req, res) => {
  let { name, email, password, password2 } = req.body;

  let errors = [];

  console.log({
    name,
    email,
    password,
    password2
  });

  if (!name || !email || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("register", { errors, name, email, password, password2 });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
    // Validation passed
    pool.query(
      `SELECT * FROM users
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          console.log(err);
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          return res.render("register", {
            message: "Email already registered"
          });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password)
                VALUES ($1, $2, $3)
                RETURNING id, password`,
            [name, email, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash("success_msg", "You are now registered. Please log in");
              res.redirect("/users/login");
            }
          );
        }
      }
    );
  }
});

app.post(
  "/users/login",
  passport.authenticate("local", {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
  })
);

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/users/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/users/login");
}

// sslServer.listen(PORT, () => console.log('sercure server'))
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// io.attach(httpsServer);
// io.attach(server);

// io.on('connection', function(client) {  
//   console.log('Client connected...');
//   client.on('click', function(data){
//     console.log(JSON.parse(data));
//       setTimeout(function() {
//         client.emit("ok", "data");
//       }, 3000);
//   })
// });