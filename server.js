// server.js
const express = require('express')
const app = express()
const fs = require('fs')
require('dotenv').config()
const session = require('express-session')
const MongoStore = require('connect-mongo')
const bcrypt = require('bcrypt')
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")

// -------------------- MONGODB SETUP --------------------
const uri = process.env.MONGO_URI
if (!uri) throw new Error("MONGO_URI is not defined in environment variables")

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
})

let db
async function connectDB() {
  try {
    await client.connect()
    db = client.db("iNoteDB") // Change to your database name
    console.log("✅ Successfully connected to MongoDB")
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err)
    process.exit(1) // Stop server if DB fails
  }
}

// -------------------- MIDDLEWARE --------------------
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})

// -------------------- SESSION --------------------
app.use(session({
  secret: process.env.SESSION_SECRET || "secret123",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }
}))

// -------------------- HELPER MIDDLEWARE --------------------
function authMiddleware(req, res, next) {
  if (!req.session.userId) return res.status(401).send("Unauthorized")
  next()
}

// -------------------- VIEW ENGINE --------------------
app.set('view engine', 'ejs')
app.set('views', './templates')

// -------------------- AUTH ROUTES --------------------

// Signup
app.get('/signup', (req, res) => res.render('signup'))
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.send("Username & password required")

    const users = db.collection('users')
    const existing = await users.findOne({ username })
    if (existing) return res.send("Username already taken")

    const hashed = await bcrypt.hash(password, 10)
    const result = await users.insertOne({ username, password: hashed, created_at: new Date() })

    req.session.userId = result.insertedId
    res.redirect('/allnotes')
  } catch (err) {
    res.status(500).send("Error creating user")
  }
})

// Login
app.get('/login', (req, res) => res.render('login'))
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const users = db.collection('users')
    const user = await users.findOne({ username })
    if (!user) return res.send("Invalid credentials")

    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.send("Invalid credentials")

    req.session.userId = user._id
    res.redirect('/allnotes')
  } catch (err) {
    res.status(500).send("Login error")
  }
})

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed")
    res.redirect('/')
  })
})

// -------------------- STATIC PAGES --------------------
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'))
app.get('/about', (req, res) => res.sendFile(__dirname + '/views/about.html'))
app.get('/contact', (req, res) => res.sendFile(__dirname + '/views/contact.html'))

// -------------------- CRUD ROUTES --------------------

// All Notes
app.get('/allnotes', async (req, res) => {
  try {
    if (!db) return res.status(500).send("Database not connected")
    const notes = db.collection('notes')
    const sort = req.query.sort
    let sortObj
    if (sort === "oldest") sortObj = { is_pinned: -1, created_at: 1 }
    else if (sort === "newest") sortObj = { is_pinned: -1, created_at: -1 }
    else sortObj = { is_pinned: -1, created_at: -1 }

    const allnotes = await notes.find().sort(sortObj).toArray()
    res.render('allnotes', { notes: allnotes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Add Note
app.get('/addnote', (req, res) => res.sendFile(__dirname + "/views/addnote.html"))
app.post('/addnote', authMiddleware, async (req, res) => {
  try {
    const notes = db.collection('notes')
    const newnote = {
      title: req.body.title,
      content: req.body.content,
      created_at: new Date(),
      updated_at: new Date(),
      is_pinned: req.body.is_pinned === "on"
    }
    await notes.insertOne(newnote)
    res.redirect("/allnotes")
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update Note
app.get('/updatenote/:id', authMiddleware, async (req, res) => {
  try {
    const notes = db.collection('notes')
    const note = await notes.findOne({ _id: new ObjectId(req.params.id) })
    if (!note) return res.status(404).send("Note not found")
    res.render('update', { note })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/updatenote/:id', authMiddleware, async (req, res) => {
  try {
    const notes = db.collection('notes')
    await notes.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          title: req.body.title,
          content: req.body.content,
          updated_at: new Date(),
          is_pinned: req.body.is_pinned === "on"
        }
      }
    )
    res.redirect('/allnotes')
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete Note
app.post('/deletenote/:id', authMiddleware, async (req, res) => {
  try {
    const notes = db.collection('notes')
    await notes.deleteOne({ _id: new ObjectId(req.params.id) })
    res.redirect('/allnotes')
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Pin/Unpin Note
app.post('/pinnote/:id', authMiddleware, async (req, res) => {
  try {
    const notes = db.collection('notes')
    const id = req.params.id
    const note = await notes.findOne({ _id: new ObjectId(id) })
    if (!note) return res.status(404).send("Note not found")

    await notes.updateOne(
      { _id: new ObjectId(id) },
      { $set: { is_pinned: !note.is_pinned, updated_at: new Date() } }
    )
    res.redirect('/allnotes')
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Contact form
app.post('/contact', (req, res) => {
  fs.writeFile('contact.json', JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).json({ error: "Failed to save data" })
    res.json({ message: "Data was saved successfully" })
  })
})

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: "iNote",
    desc: "lightweight note application",
    version: "1.0.0",
    author: "Ramazan Kozhabek",
    license: "AITU"
  })
})

// Unknown routes
app.use((req, res) => res.status(404).send('<h1>Unknown route</h1>'))

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`))
})
