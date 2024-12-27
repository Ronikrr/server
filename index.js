const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // For generating a secret key
const multer = require("multer");
const dotenv = require("dotenv");
const ipadd = '192.168.29.189'
require('dotenv').config();

const teamRoutes = require('./teampage')

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
    phoneNo: { type: String, match: /^[0-9]{10}$/ },
    username: { type: String, },
    profileImage: { type: String },
});



const User = mongoose.model('Users', UserSchema)

const path = require("path");
const secretKey = crypto.randomBytes(64).toString('hex');


console.log(secretKey)
const app = express();
const mongoURI = process.env.MONGO_URI

// Connect to MongoDB
mongoose.connect(mongoURI)
    .then(() => {
        console.log('MongoDB connected successfully!');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });

app.use('/api', teamRoutes);

app.use(cors());
app.use(bodyParser.json());
const authenticate = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        console.log('Token decoded successfully:', decoded);
        req.user = decoded; // Attach the decoded user info
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired.' });
        }
        console.error('Token verification failed:', error);
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
};




//////////user profile image //////////////////////

app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message });
});
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '../image'); // Directory to store uploaded files
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name
    },
});
const upload = multer({ storage });

// app.use('/uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'server', 'uploads')));


app.post('/upload-profile', upload.single('profileImage'), async (req, res) => {
    console.log(req.file);
    console.log(req.body._id);
    console.log(req.file.path);

    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const _id = req.body._id;
    const filePath = req.file.filename;

    try {
        // Use await and new mongoose.Types.ObjectId
        console.log('User ID:', _id);
        const updatedUser = await User.findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(_id) }, // Find user by _id
            { profileImage: filePath },                 // Update the profileImage field
            { new: true }                               // Return the updated user
        );

        console.log('User:', _id);  // This should show null if no user is found
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Add the profile image URL to the user object
        await updatedUser.save();
        // Successfully uploaded the file
        res.json({ message: 'Profile image uploaded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching user' });
    }
});


app.get("/view-profile", authenticate, async (req, res) => {
    console.log("Query:", req.query);

    try {
        const userId = req.query.userid;
        console.log("Received userId:", userId);

        // Validate the userId parameter
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ status: "error", message: "Invalid or missing User ID" });
        }

        // Convert userId to ObjectId
        const objectId = new mongoose.Types.ObjectId(userId);

        // Fetch images for the given userId, and make sure profileImage is properly queried
        const images = await User.find({ _id: objectId }).select('profileImage url');  // Changed userId to _id

        console.log("Fetched images:", images);

        if (images.length === 0) {
            return res.status(404).json({ status: "error", message: "No images found for the provided User ID" });
        }

        res.send({ status: "ok", data: images });
    } catch (error) {
        console.error("Error:", error.message);  // Log error message for better clarity
        res.status(500).json({ status: "error", message: error.message });
    }
});




app.post('/users', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const user = new User({ name, email, password });
        console.log(user)
        const doc = await user.save();
        res.status(201).json({ message: "User  registered successfully", user: doc });
    } catch (error) {
        console.error("Error saving user:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: "Username or email already exists." });
        }
        res.status(500).json({ message: "Internal server error" });
    }
})
app.get('/users', async (req, res) => {
    try {
        // Fetch all users from the database
        const users = await User.find();
        res.status(200).json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email' });
        }

        if (user.password !== password) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ id: user._id, email: user.email }, secretKey, { expiresIn: '1h' });

        res.json({ message: 'Login successful', token });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

app.get('/profile', authenticate, async (req, res) => {
    try {
        const { email, username, phoneNo, profileImage } = req.body;

        const updates = {};
        if (email) updates.email = email;
        if (username) updates.username = username;
        if (phoneNo) updates.phoneNo = phoneNo;
        if (profileImage) updates.profileImage = profileImage;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            password: updatedUser.password,
            email: updatedUser.email,
            phoneNo: updatedUser.phoneNo,
            profileImage: updatedUser.profileImage,
        };

        res.json({ message: "Profile updated successfully.", user: userResponse });
    } catch (error) {
        console.error("Error updating profile:", error);

        if (error.code === 11000) { // Handle unique constraint errors (email)
            return res.status(400).json({ message: "Email must be unique." });
        }

        res.status(500).json({ message: "Internal server error." });
    }
});



app.put('/profile', authenticate, async (req, res) => {
    try {
        const { email, username, phoneNo, profileImage } = req.body;



        const updates = {};
        if (email) updates.email = email;
        if (username) updates.username = username;
        if (phoneNo) updates.phoneNo = phoneNo;
        if (profileImage) updates.profileImage = profileImage;

        // Use `req.user.id` from the JWT to update the logged-in user's profile
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id, // use decoded user ID from JWT
            { $set: updates },
            {
                new: true, // Return the updated document
                runValidators: true, // Apply validation rules
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User  not found." });
        }

        const userResponse = {
            id: updatedUser._id,
            name: updatedUser.name,
            username: updatedUser.username,
            password: updatedUser.password,
            email: updatedUser.email,
            phoneNo: updatedUser.phoneNo,
            profileImage: updatedUser.profileImage,
        };

        res.json({ message: "Profile updated successfully.", user: userResponse });
    } catch (error) {
        console.error("Error updating profile:", error);

        if (error.code === 11000) { // Handle unique constraint errors (email)
            return res.status(400).json({ message: "Email must be unique." });
        }

        res.status(500).json({ message: "Internal server error." });
    }
});


//////////////////////////////////////////////   view couts


const viewCountSchema = new mongoose.Schema({
    count: {
        type: Number,
        default: 0
    }
});

const ViewCount = mongoose.model('ViewCount', viewCountSchema);

app.get('/view_count', async (req, res) => {
    const viewCount = await ViewCount.findOne();

    res.json(viewCount);
})
app.post('/increment_viewcount', async (req, res) => {
    let viewCount = await ViewCount.findOne();  // Use `let` instead of `const`
    if (viewCount) {
        viewCount.count += 1;
        await viewCount.save();
    } else {
        viewCount = new ViewCount({ count: 1 });  // This is fine now since `viewCount` is declared with `let`
        await viewCount.save();
    }
    res.json({ message: 'View count incremented' });
});



////////////////////////////////////////////////////////////////////  contact form //////////////////

const contactformSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    contactnumber: { type: String, match: /^[0-9]{10}$/, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true }
});

const ContactForm = mongoose.models.ContactForm || mongoose.model('ContactForm', contactformSchema);

app.post("/contactform", async (req, res) => {
    try {
        const { name, email, contactnumber, subject, message } = req.body
        if (!name || !email || !contactnumber || !subject || !message) {
            return res.status(400).json({ message: "All fields are required" })
        }

        const contact = new ContactForm({ name, email, contactnumber, subject, message })
        console.log(contact)
        const doc = await contact.save();
        res.status(201).json({ message: "ok", data: doc });
    } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({ message: "Internal server error" });
    }

})
app.get('/view_contactform', async (req, res) => {
    const view_contactform = await ContactForm.findOne();

    res.json(view_contactform);
})












app.listen(8000, () => {
    console.log('Server connected on port 192.168.29.189:8000');
    // console.log('Server connected on port 192.168.29.189:8000');
});
