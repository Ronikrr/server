const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors')
const app = express();
app.use(cors());
const router = express.Router();
// Define the teampage schema and model
const teampageSchema = new mongoose.Schema({
    name: { type: String },
    post: { type: String },
    image: { type: String }, // Store the image file path
    linkedin: { type: String },
    insta: { type: String },
    facebook: { type: String },
});

const teampage = mongoose.model('Teampage', teampageSchema);
app.use(bodyParser.json());

app.use(cors({
    origin: '*', // For development, use * or specify frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE' ,'get','post','put','delete'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
}));


// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads'); // Directory to store uploaded files
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name
    },
});

const upload = multer({ storage });

// CREATE: Add a new team member with an image
router.post('/teampage', upload.single('image'), async (req, res) => {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);
    try {
        const { name, post, linkedin, insta, facebook } = req.body;
        const imagePath = req.file;

        const newMember = new teampage({ name, post, linkedin, insta, facebook, image: imagePath.path });
        const savedMember = await newMember.save();
        res.status(200).json({ message: 'Team member created successfully', member: savedMember });
    } catch (error) {
        console.error('Error creating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// READ: Get all team members (with image URLs)
router.get('/teampage', async (req, res) => {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);
    try {
        const members = await teampage.find();
        res.status(200).json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// READ: Get a single team member by ID
router.get('/teampage/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const member = await teampage.findById(id);
        if (!member) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        res.status(200).json(member);
    } catch (error) {
        console.error('Error fetching team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// UPDATE: Update a team member's details, including the image
router.put('/teampage/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        if (req.file) {
            updates.image = req.file.path;
        }

        const updatedMember = await teampage.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }
        res.status(200).json({ message: 'Team member updated successfully', member: updatedMember });
    } catch (error) {
        console.error('Error updating team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// DELETE: Remove a team member
router.delete('/teampage/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedMember = await teampage.findByIdAndDelete(id);
        if (!deletedMember) {
            return res.status(404).json({ message: 'Team member not found' });
        }

        // Delete the image file if it exists
        if (deletedMember.image && fs.existsSync(deletedMember.image)) {
            fs.unlinkSync(deletedMember.image);
        }

        res.status(200).json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

module.exports = router;
