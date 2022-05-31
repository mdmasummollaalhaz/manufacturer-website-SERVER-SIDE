const express = require("express")
const app = express()
const cors = require("cors")
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 8000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors())
app.use(express.json())



// connect with mongodb
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ab5rv.mongodb.net/?retryWrites=true&w=majority`;
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9bi2h.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// JWT token
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}


async function run() {
    try {
        await client.connect();
        const collectionParts = client.db('monota').collection('parts')
        const collectionOrders = client.db('monota').collection('orders')
        const paymentCollection = client.db('monota').collection('payments');
        const reviewsCollection = client.db('monota').collection('reviews');
        const usersCollection = client.db('monota').collection('users');


        // Add new parts 
        app.post('/parts', async (req, res) => {
            const newParts = req.body
            const result = await collectionParts.insertOne(newParts)
            res.send(result)
        })

        // Get all parts item API
        app.get('/parts', async (req, res) => {
            const query = {}
            const cursor = collectionParts.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // Delete part API
        app.delete('/parts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await collectionParts.deleteOne(query)
            res.send(result)

        })

        // Get single parts item API
        app.get('/parts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await collectionParts.findOne(query)
            res.send(result)

        })



        // Add new Order
        app.post('/orders', async (req, res) => {
            const newOrder = req.body
            const result = await collectionOrders.insertOne(newOrder)
            res.send(result)
        })

        // Get all Orders API
        app.get('/orders', verifyJWT, async (req, res) => {
            const query = {}
            const cursor = collectionOrders.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // Delete order
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await collectionOrders.deleteOne(query)
            res.send(result)
        })

        // Get spacific user orders
        app.get('/my-orders', verifyJWT, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const myOrders = await collectionOrders.find(query).toArray()
            res.send(myOrders)
        })

        // Get my order by id
        app.get('/my-orders/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await collectionOrders.findOne(query)
            res.send(result)

        })

        // Make order shipped
        app.put("/orders/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: true
                }
            }
            const result = await collectionOrders.updateOne(filter, updatedDoc);
            res.send(result)

        })


        // Delete my order
        app.delete('/my-orders/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await collectionOrders.deleteOne(query)
            res.send(result)

        })

        // Payment intent API
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        app.patch('/my-orders/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await collectionOrders.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })

        // Add new Review
        app.post('/reviews', async (req, res) => {
            const newReviews = req.body
            const result = await reviewsCollection.insertOne(newReviews)
            res.send(result)
        })
        // Get all Reviews API
        app.get('/reviews', async (req, res) => {
            const query = {}
            const cursor = reviewsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // Get all Users items API
        app.get('/users', verifyJWT, async (req, res) => {
            const query = {}
            const cursor = usersCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        // // // Add new user
        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        // Get spacific user
        app.get('/user', verifyJWT, async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const cursor = usersCollection.find(query)
            const users = await cursor.toArray(cursor)
            res.send(users)
        })




        // admin user API
        app.put('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        app.put("/users", async (req, res) => {
            const email = req.query.email;
            const updateUser = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: updateUser,
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })
            res.send({ result, token });
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });

        // Get all admin
        app.get('/admin', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.get('/user/admin', verifyJWT, async (req, res) => {
            const email = req.query.email
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // auth
        app.post('/login', async (req, res) => {
            const user = req.body
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '10d'
            })
            res.send({ accessToken })
        })





    }
    finally {

    }
}
run().catch(console.dir);




app.get("/", (req, res) => {
    res.send("Hello Node for Manufature")
})



app.listen(port, () => {
    console.log("Listing Server from", port)
})