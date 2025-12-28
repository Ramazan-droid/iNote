const express = require('express');
const app = express();
const fs = require('fs');

app.use(express.static('public'));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use((req,res,next) => {
    console.log(req.method,req.url);
    next();
});

app.get('/',(req,res) => {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/about',(req,res) => {
    res.sendFile(__dirname + '/views/about.html');
});

app.get('/search',(req,res) => {
    const title = req.query.title;

    if(title){
        res.json({Title:title});
    }else{
        res.status(400).json({error:"Title is required"});
    }
});

app.get('/task/:id',(req,res) => {
    const id = req.params.id
    res.json({task_id:id});
});

app.get('/contact',(req,res) => {
    res.sendFile(__dirname + '/views/contact.html');
});

app.post('/contact',(req,res) => {
    const data = req.body;
    console.log(data);
    // res.send(`<h1>Thanks,${req.body.name}!Your message has been received.</h1>`);
    fs.writeFile(
        'contact.json',
        JSON.stringify(data,null,2),
        (err) => {
            if(err){
                res.status(500).json({error:"Failed to save data"});
            }
            res.json({message:"Data was saved succesfully"});
        }
    );
});

app.get('/api/info',(req,res) => {
    res.json({
        name:"iNote",
        desc:"lightweight note application",
        version:"1.0.0",
        author:"Ramazan Kozhabek",
        license:"AITU"
    });
});

app.use((req,res) => {
    res.send('<h1>Unknown route</h1>');
});

app.listen(3000,() => {
    console.log("Server is running");
})