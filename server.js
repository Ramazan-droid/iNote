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
    secure: false,
    sameSite:'lax'
  }
}))
app.get('/debug-session', (req, res) => {
  res.json(req.session)
})

// Make session user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null
  next()
})

// -------------------- HELPER MIDDLEWARE --------------------
function authMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.status(401).send("Unauthorized")
  }
  next()
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.render("login-required")
  }
  next()
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).send("Admins only")
  }
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

    // Check if username already exists
    const existing = await users.findOne({ username })
    if (existing) return res.send("Username already taken")

    // Hash the password
    const hashed = await bcrypt.hash(password, 10)

    // Insert user with role = 'user' by default
    const result = await users.insertOne({
      username,
      password: hashed,
      role: "user",        // ✅ default role
      created_at: new Date()
    })

    // Save session with id, username, role
    req.session.user = {
      id: result.insertedId,
      username,
      role: "user"         // ✅ include role in session
    }

    res.redirect('/allnotes')
  } catch (err) {
    console.error(err)
    res.status(500).send("Error creating user")
  }
})

const ADMIN_USERNAME = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

// Login
app.get('/login', (req, res) => res.render('login'))
app.post('/login', async (req, res) => {
  const { username, password } = req.body

  const users = db.collection('users')

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.user = {
      id: "admin",
      username: username,
      role: "admin"
    }
    return res.redirect('/admin')
  }
  const user = await users.findOne({ username })

  if (!user) {
    return res.status(401).render('login', { error: 'Invalid credentials' })
  }

  const match = await bcrypt.compare(password, user.password)
  if (!match) {
    return res.status(401).render('login', { error: 'Invalid credentials' })
  }


  req.session.user = {
    id: user._id,
    username: user.username
  }

  res.redirect('/allnotes')
})

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed")
    res.redirect('/')
  })
})


app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'))
app.get('/about', (req, res) => res.sendFile(__dirname + '/views/about.html'))
app.get('/contact', (req, res) => res.sendFile(__dirname + '/views/contact.html'))



// All Notes
app.get('/allnotes', requireLogin, async (req, res) => {
  try {
    if (!db) return res.status(500).send("Database not connected")
    const notes = db.collection('notes')
    const sort = req.query.sort
    let sortObj
    if (sort === "oldest") sortObj = { is_pinned: -1, created_at: 1 }
    else if (sort === "newest") sortObj = { is_pinned: -1, created_at: -1 }
    else sortObj = { is_pinned: -1, created_at: -1 }

    const allnotes = await notes.find({ userId: req.session.user.id }).sort(sortObj).toArray()
    res.render('allnotes', { notes: allnotes,user: req.session.user })
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
      userId: req.session.user.id,   // 👈 AUTO-SET USER
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

app.get('/admin', requireAdmin, async (req, res) => {
  try {
    const usersCollection = db.collection('users')
    const notesCollection = db.collection('notes')

    const users = await usersCollection.find().toArray()
    const notes = await notesCollection.find().toArray()

    // attach username to each note
    const notesWithUsernames = notes.map(note => {
      const owner = users.find(u => u._id.toString() === note.userId?.toString())
      return {
        ...note,
        ownerUsername: owner ? owner.username : "Unknown"
      }
    })

    res.render('admin', {
      user: req.session.user,
      users,
      notes: notesWithUsernames
    })
  } catch (err) {
    console.error(err)
    res.status(500).send("Server error")
  }
})

app.post('/admin/deletenote/:id', requireAdmin, async (req, res) => {
  try {
    const notesCollection = db.collection('notes')

    // Delete the note by its _id
    await notesCollection.deleteOne({ _id: new ObjectId(req.params.id) })

    res.redirect('/admin') // back to admin dashboard
  } catch (err) {
    console.error(err)
    res.status(500).send("Server error")
  }
})

app.get('/admin/updatenote/:id', requireAdmin, async (req, res) => {
  try {
    const notesCollection = db.collection('notes')
    const note = await notesCollection.findOne({ _id: new ObjectId(req.params.id) })
    if (!note) return res.send("Note not found")

    res.render('admin-update-note', { note, user: req.session.user })
  } catch (err) {
    console.error(err)
    res.status(500).send("Server error")
  }
})

app.post('/admin/updatenote/:id', requireAdmin, async (req, res) => {
  try {
    const { title, content, is_pinned } = req.body
    const notesCollection = db.collection('notes')

    await notesCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          title,
          content,
          is_pinned: is_pinned === "on",
          updated_at: new Date()
        }
      }
    )

    res.redirect('/admin') // back to admin dashboard
  } catch (err) {
    console.error(err)
    res.status(500).send("Server error")
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
