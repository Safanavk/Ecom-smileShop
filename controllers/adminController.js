const User = require('../model/userSchema');
const bcrypt = require('bcrypt');
require('dotenv').config();



// Home Page
const getHomePage = async (req, res) => {
  try {
    if (!req.session.admin) {
      console.log("Redirecting to login");
      return res.redirect('/admin/login');
    }

    console.log("Rendering dashboard view");
    return res.render('admin/dashboard', {
      title: "Dashboard",
      layout: 'adminlayout',
      admin: req.session.admin,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }
};

const getLoginPage = async (req, res) => {
  try {
    const locals = {
      title: `Admin Login Page`
    };
    if (!req.session.admin) {
      console.log("Rendering login page");
      res.render("admin/login", { title: locals.title, layout: 'adminlayout' });
    } else {
      console.log("Already logged in, redirecting to dashboard");
      res.redirect('/admin/dashboard');
    }
  } catch (error) {
    console.log(error.message);
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email });

    if (!admin) {
      return res.render("admin/login", { error_msg: "Invalid email or password.", layout: 'adminlayout' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render("admin/login", { error_msg: "Invalid email or password.", layout: 'adminlayout' });
    }

    req.session.admin = admin;
    return res.redirect("/admin/dashboard");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("An error occurred during login.");
  }
};


// Logout user
const logoutUser = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log(err.message);
                res.render('admin/dashboard',{layout:'adminlayout'})
                return res.status(500).send("An error occurred during logout.");
            }
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).send("An error occurred during logout.");
    }
};


// User Management
const getAllUsers = async (req, res) => {
  try {
      if (req.session.admin) {
          const allUsers = await User.find();
          res.render('admin/userlist/userList', {
              layout: 'adminlayout',
              title: "User Management Page",
              users: allUsers
          });
      } else {
          res.redirect('/admin/login');
      }
  } catch (err) {
      console.log('Some Error ' + err);
      res.redirect('/admin/dashboard'); // Redirect to a safe location if there's an error
  }
};

// Block User
const blockUser = async (req, res) => {
  try {
      const userId = req.params.id;
      await User.findByIdAndUpdate(userId, { isBlocked: true });
      res.json({ success: true });
  } catch (error) {
      console.error('Error blocking user:', error);
      res.json({ success: false });
  }
};

// Unblock User
const unblockUser = async (req, res) => {
  try {
      const userId = req.params.id;
      await User.findByIdAndUpdate(userId, { isBlocked: false });
      res.json({ success: true });
  } catch (error) {
      console.error('Error unblocking user:', error);
      res.json({ success: false });
  }
};



module.exports = {
    getLoginPage,
    getHomePage,
    loginUser,
    logoutUser,
    getAllUsers,
    blockUser,
    unblockUser
}