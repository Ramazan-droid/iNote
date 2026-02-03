// server.js
const express = require('express')
const app = express()
const fs = require('fs')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")

// -------------------- MONGODB SETUP --------------------
const uri = process.env.MONGO_URI
if (!uri) throw new Error("MONGO_URI is not defined in environment variables")

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

let db // global DB variable

async function connectDB() {
  try {
    await client.connect()
    db = client.db("iNoteDB") // change to your database name
    console.log("✅ Successfully connected to Railway MongoDB")
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err)
    process.exit(1) // stop server if DB fails
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

app.set('view engine', 'ejs')
app.set('views', './templates')

// -------------------- ROUTES --------------------

// Home / Static pages
app.get('/', (req, res) => res.sendFile(__dirname + '/views/index.html'))
app.get('/about', (req, res) => res.sendFile(__dirname + '/views/about.html'))
app.get('/contact', (req, res) => res.sendFile(__dirname + '/views/contact.html'))

// Add Note
app.get('/addnote', (req, res) => res.sendFile(__dirname + "/views/addnote.html"))
app.post('/addnote', async (req, res) => {
  try {
    if (!db) return res.status(500).send("Database not connected")
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

// Pin/Unpin Note
app.post('/pinnote/:id', async (req, res) => {
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

// Update Note
app.get('/updatenote/:id', async (req, res) => {
  try {
    const notes = db.collection('notes')
    const note = await notes.findOne({ _id: new ObjectId(req.params.id) })
    if (!note) return res.status(404).send("Note not found")
    res.render('update', { note })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/updatenote/:id', async (req, res) => {
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
app.post('/deletenote/:id', async (req, res) => {
  try {
    const notes = db.collection('notes')
    await notes.deleteOne({ _id: new ObjectId(req.params.id) })
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
  app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`)
  })
})
