const express = require('express');
const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({extended:true}));

app.get('/',(req,res) => {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/about',(req,res) => {
    res.sendFile(__dirname + '/views/about.html');
});

app.get('/contact',(req,res) => {
    res.sendFile(__dirname + '/views/contact.html');
});

app.post('/contact',(req,res) => {
    console.log(req.body);
    res.send(`<h1>Thanks,${req.body.name}!Your message has been received.</h1>`);
});

app.use((req,res) => {
    res.send('<h1>Unknown route</h1>');
});

app.listen(3000,() => {
    console.log("Server is running");
})