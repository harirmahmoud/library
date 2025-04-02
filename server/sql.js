const express=require("express")
const cors=require("cors")
const mysql=require('mysql2')
const jwt=require('jsonwebtoken')
const bcrypt=require('bcrypt')
const dotenv=require('dotenv')
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });
dotenv.config()
const app=express()
app.use(cors())
app.use(express.json())
const db=mysql.createConnection({
  host: process.env.VITE_LOCAL,
  user: process.env.VITE_USER,
  password: process.env.VITE_PASSWORD,
  database: process.env.VITE_DATABASE
})
app.get('/',(req,res)=>{
    res.send("hello")
})

app.get('/book',(req,res)=>{
  const {subject,search}=req.query
  if(subject=="all"){
    const sql = `SELECT * FROM book inner join author on author.id_book=book.id_book WHERE book.title LIKE ? `;
    db.query(sql, [`%${search}%`, ], (err, results) => {
      if (err) return res.status(500).send('Error fetching books');
      else{
        return res.status(200).json(results);
      }
      
    });
  }else{
    const sql = `SELECT * FROM book inner join author on author.id_book=book.id_book WHERE book.title LIKE ? AND book.category LIKE ?`;
    db.query(sql, [`%${search}%`, `%${subject}%`], (err, results) => {
      if (err) return res.status(500).send('Error fetching books');
      
     return res.status(200).json(results);
    });
  }
 
})

app.get('/auth',(req,res)=>{
    const {subject,search}=req.query
    if(subject=="all"){
      const sql = `SELECT * FROM book inner join author on author.id_book=book.id_book WHERE author.name LIKE ? `;
      db.query(sql, [`%${search}%`, ], (err, results) => {
        if (err) return res.status(500).send('Error fetching books');
        else{
          return res.status(200).json(results);
        }
        
      });
    }else{
      const sql = `SELECT * FROM book inner join author on author.id_book=book.id_book WHERE book.title LIKE ? AND book.category LIKE ?`;
      db.query(sql, [`%${search}%`, `%${subject}%`], (err, results) => {
        if (err) return res.status(500).send('Error fetching books');
        
       return res.status(200).json(results);
      });
    }
   
  })

app.get('/bookd/:id',(req,res)=>{
    const { id } = req.params;
    console.log(id)

      const sql = `SELECT * FROM book inner join author on author.id_book=book.id_book WHERE book.id_book=? `;
      db.query(sql, [id ], (err, results) => {
        if (err) return res.status(500).send('Error fetching books');
        
       return res.status(200).json(results);
      });
    
    
  })


app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    // First query to check if user exists
    db.query('SELECT * FROM user WHERE name = ?', [username], (err, data) => {
        if (err) {
            return res.status(500).send("Error while checking for user: " + err);
        }

        if (data.length > 0) {
            return res.status(409).json({ message: "The user already existed!" });
        }

        // If user doesn't exist, hash the password
        bcrypt.hash(password, 10, (err, hashPass) => {
            if (err) {
                return res.status(500).send("Error while hashing password: " + err);
            }

            // Insert new user into the database with the hashed password
            db.query('INSERT INTO user (name, email, password) VALUES (?, ?, ?)', [username, email, hashPass], (err, result) => {
                if (err) {
                    return res.status(500).send("Error while creating user: " + err);
                }

                // Respond with success
                return res.status(201).send("User created successfully!");
            });
        });
    });
});

app.post('/login', (req, res) => {
    const { username, email, password } = req.body;

    
    db.query('SELECT * FROM user WHERE name = ?', [username],async (err, data) => {
        if (err) {
            return res.status(500).send("Error while checking for user: " + err);
        }

        if (data.length == 0) {
            return res.status(404).json({ message: "The user not existed!" });
        }


       const isMatch=await bcrypt.compare(password,data[0].password)
       if(!isMatch){
        return res.status(401).json({ message: "wrong password !!" });
       }
       const token=jwt.sign({id: data[0].name},process.env.SECRET,{expiresIn:'3h'})
       return res.status(201).json({token:token})
    });
});

app.post('/like',(req,res)=>{
    const {username,book}=req.body
    db.query('insert into saves (id_book,name) values (?,?) ',[book,username],(err,data)=>{
        if (err) {
            return res.status(500).send("Error while saving this book: " + err);
        }
        return res.status(201).send("the book has been saved successfully!");
    })
})

app.post('/delete', (req, res) => {
    const { username, book } = req.body;
    console.log({book,username})
    
    db.query('DELETE FROM saves WHERE id_book = ? AND name = ?', [book, username], (err, data) => {
      if (err) {
        return res.status(500).send("Error: " + err);  
      }else{
        
        return res.status(200).send("Deleted successfully!");
      }
      
    });
  });
  app.post('/check', (req, res) => {
    const { username, book } = req.body;
    db.query('SELECT * FROM saves WHERE id_book = ? AND name = ?', [book, username], (err, data) => {
      if (err) {
        console.log(err)
        return res.status(500).send("Error while checking the book: " + err);
      }
      if (data.length === 0) return res.status(404).send("Book not found!");
      else{
       
        return res.status(200).send("The book has already been saved.");
      }
     
    });
  });

  app.post('/checks', (req, res) => {
    const { username } = req.body;
    db.query('SELECT * FROM saves inner join book on saves.id_book=book.id_book WHERE saves.name = ?', [ username], (err, data) => {
      if (err) {
        console.log(err)
        return res.status(500).send("Error while checking the book: " + err);
      }
     
      else{
       
        return res.status(200).send(data);
      }
     
    });
  });

const verifyToken=async(req,res,next)=>{
    try{
        const token=req.headers['authorization'].split(' ')[1];
        if(!token){
            return res.status(403).json({message:"No token provided !!"})
        }
        const decoder=jwt.verify(token,process.env.SECRET)
        req.userId=decoder.id;
        next()
    }catch(err){
        return res.status(500).json({message:"error server !!"})
    }
}

app.get('/home',verifyToken,async (req,res)=>{
    db.query('SELECT * FROM user WHERE name = ?', [req.userId],async (err, data) => {
        if (err) {
            return res.status(500).send("Error while checking for user: " + err);
        }

        if (data.length == 0) {
            return res.status(404).json({ message: "The user not existed!" });
        }
        return res.status(201).json({user:data[0]})})
})

app.post("/convert", upload.single("file"), (req, res) => {
    const mobiFilePath = req.file.path;
    const pdfFilePath = `${mobiFilePath}.pdf`;
  
    // Convert the mobi file to PDF using Calibre's ebook-convert command
    exec(`ebook-convert ${mobiFilePath} ${pdfFilePath}`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ message: "Conversion failed", error });
      }
  
      // Send the PDF back to the client
      res.download(pdfFilePath, "converted.pdf", (err) => {
        if (err) {
          console.error(err);
        }
  
        // Clean up files after sending
        fs.unlink(mobiFilePath, () => {});
        fs.unlink(pdfFilePath, () => {});
      });
    });
  });


app.listen(3000,()=>{
    console.log("listenning to port 3000 ...")
})