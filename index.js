const cool = require('cool-ascii-faces');
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000

const Datastore = require('nedb')
let db = {}
db.books = new Datastore()
let books = [{ title: "Example1", author: "Lee", price: 100 },
                { title: "Example2", author: "Kim", price: 200 },
                { title: "Example3", author: "Choi", price: 300 },
                { title: "Example4", author: "Park", price: 400 }]


db.books.insert(books, (err, newDoc) => {   // Callback is optional
    if(err){
        return console.log(`insert Error ${err}`)
    }
    console.log(`inserted document : ${JSON.stringify(newDoc)}`)

})
db.books.find({}, (err, docs) => {
    if(err){
        return console.log(`find Error ${err}`)
    }
    console.log(`find document : ${JSON.stringify(docs)}`)
})

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .get('/cool', (req, res) => res.send(cool()))
  .get('/books', (req,res) => db.books.find({}, (err, books) => {
      if(err){
        return res.status(500).send({error: 'database failure'})
      }
      res.json(books)
  }))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
