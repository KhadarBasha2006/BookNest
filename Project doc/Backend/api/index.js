// Vercel Serverless entry – wraps the existing Express app so it runs
// as a single serverless function behind a catch-all route.

require('dotenv').config()

const express = require('express')
const path = require('node:path')
const fs = require('node:fs')
const cors = require('cors')
const connectDatabase = require('../db/config')
const multer = require('multer')
const Admin = require('../db/Admin/Admin')
const users = require('../db/Users/userschema')
const seller = require('../db/Seller/Sellers')
const items = require('../db/Seller/Additem')
const myorders = require('../db/Users/myorders')
const WishlistItem = require('../db/Users/Wishlist')

const app = express()

// Use /tmp for file uploads in serverless environment
const uploadDirectory = '/tmp/uploads'
fs.mkdirSync(uploadDirectory, { recursive: true })

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

app.use(express.json({ limit: '1mb' }))
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
            return
        }
        callback(new Error('Origin is not allowed by the BookNest CORS policy.'))
    },
    methods: ["POST", "GET", "DELETE", "PUT"],
    credentials: true
}));

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: function (req, file, callback) {
        callback(null, `${Date.now()}-${path.basename(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(_req, file, callback) {
        if (!file.mimetype.startsWith('image/')) {
            callback(new Error('Only image uploads are supported.'))
            return
        }
        callback(null, true)
    },
})
app.use('/uploads', express.static(uploadDirectory));

                                          //  Admin  //
// Login
app.post('/alogin', (req, resp) => {  
    const { email, password } = req.body;   
    Admin.findOne({ email: email })
        .then(user => {
            if (user) {
                if (user.password === password) {
                    return resp.json({ Status: "Success", user: { id:user.id,name: user.name, email: user.email } })
                } else {
                    resp.json("login fail")
                }
            } else {
                resp.json("no user")
            }
        })
  })
  
  // Register Api
app.post('/asignup', (req, resp) => {
    const { name, email, password } = req.body;
    Admin.findOne({ email: email })
        .then(use => {
            if (use) {
                resp.json("Already have an account")
            } else {
                Admin.create({ email: email, name: name, password: password })
                    .then(result => resp.json("  Account Created"))
                    .catch(err => resp.json(err))
            }
        }).catch(err => resp.json("failed "))
  })

app.get('/users',(req,res)=>{
    users.find()
    .then((user)=>{
        res.status(200).json(user)
    })
    .catch(() => {
        res.sendStatus(500)
    })
})
app.delete('/userdelete/:id',(req,res)=>{
    const { id }=req.params
     users.findByIdAndDelete(id)
     .then(() => {
        res.sendStatus(200);
    })
    .catch((error) => {
        res.status(500).json({ error: 'Internal server error' });
    });
  })
  app.delete('/userorderdelete/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await myorders.findByIdAndDelete(id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  app.delete('/useritemdelete/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await items.findByIdAndDelete(id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

app.get('/sellers',(req,res)=>{
    seller.find()
    .then((seller)=>{
        res.status(200).json(seller)
    })
    .catch(() => {
        res.sendStatus(500)
    })
})

app.delete('/sellerdelete/:id',(req,res)=>{
    const { id }=req.params
     seller.findByIdAndDelete(id)
     .then(() => {
        res.sendStatus(200);
    })
    .catch((error) => {
        res.status(500).json({ error: 'Internal server error' });
    });
  })
    app.get('/orders', (req, res) => {
    myorders.find()
        .then((orders) => {
            res.status(200).json(orders)
        })
        .catch(() => {
            res.sendStatus(500)
        })
});

// Health check used for post-deployment verification
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'BookNest API' })
})

app.use((error, _req, res, _next) => {
    console.error('BookNest request failed:', error)
    if (res.headersSent) return
    if (error instanceof multer.MulterError || error.message === 'Only image uploads are supported.') {
        res.status(400).json({ error: error.message })
        return
    }
    res.status(500).json({ error: 'The request could not be completed.' })
})

// Connect to MongoDB once (connection is cached across warm invocations)
let isConnected = false;
const ensureConnection = async () => {
    if (!isConnected) {
        await connectDatabase();
        isConnected = true;
    }
};

// Wrap the Express app for Vercel serverless
module.exports = async (req, res) => {
    await ensureConnection();
    return app(req, res);
};