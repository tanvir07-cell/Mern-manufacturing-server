const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
var jwt = require("jsonwebtoken");
const cors = require("cors");

// for mailgun smtp service:
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");

// for stripe:
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware:
// app.use(cors());
// app.use(express.json());
// const corsConfig = {
//   origin: true,
//   credentials: true,
// };
// app.use(cors(corsConfig));
// app.options("*", cors(corsConfig));

// app.use(cors({ origin: "*" }));

const port = process.env.PORT || 4000;
// app.use(express.json());
app.use(bodyParser.json());

// app.use(cors());
const corsConfig = {
  origin: true,
  credentials: true,
};
app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

const auth = {
  auth: {
    api_key: "a19196dea392fdbe09f9e420c0b9ac80-787e6567-e737d84b",
    domain: "sandbox8d96d6ea2b0645db9d0508c5815ad3b6.mailgun.org",
  },
};

const nodemailerMailgun = nodemailer.createTransport(mg(auth));
function sendPaymentEmail(payment) {
  const { transactionId, productId, email } = payment;

  const sendEmail = {
    from: "tr9836859@gmail.com",
    to: email,
    subject: `Hey! ${email} see your Payment Description`,
    text: `Hey! ${email} see your Payment Description`,
    html: `
      <div>
        <p> Hello ${email}, </p>
        <h3>Your Payment ID : ${transactionId} </h3>
        <h4>Your Product ID : ${productId}</h4>
       
        <h3>Our Address</h3>
        <p>Staff-Quatar,Demra-Dhaka</p>
        <p>Bangladesh</p>
        
      </div>
    `,
  };

  nodemailerMailgun.sendMail(sendEmail, (err, info) => {
    if (err) {
      console.log(err);
    } else {
      console.log(info);
    }
  });
}

// verify Jwt token:

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized Access" });
  }
  // I get token with Bearer from the client side now I remove this Bearer:
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET_KEY, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
  console.log(token);
}

// mongoDb:

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vtdes.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const partsCollection = client
      .db("mern-manufacturing-bike")
      .collection("parts");
    const purchasedPartsCollection = client
      .db("mern-manufacturing-bike")
      .collection("purchases");

    const usersCollection = client
      .db("mern-manufacturing-bike")
      .collection("users");
    const reviewsCollection = client
      .db("mern-manufacturing-bike")
      .collection("reviews");
    const paymentsCollection = client
      .db("mern-manufacturing-bike")
      .collection("payments");

    // const adminAddedProductsCollection = client
    //   .db("mern-manufacturing-bike")
    //   .collection("addProducts");

    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find({}).toArray();
      res.send(result);
    });

    // get only 6 part in home page:
    app.get("/part", async (req, res) => {
      const result = await partsCollection.find({}).limit(6).toArray();
      res.send(result);
    });

    // get individual part:
    app.get("/part/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;

      const filter = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(filter);
      res.send(result);
      console.log(id);
    });
    // post to the database after purchasing:
    app.post("/part", async (req, res) => {
      const data = req.body;
      const result = await purchasedPartsCollection.insertOne(data);
      res.send(result);
      console.log(data);
    });

    // get to the purchase items through users email address:
    app.get("/orders-part/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;

      if (email === decodedEmail) {
        const filter = { email: email };
        const result = await purchasedPartsCollection.find(filter).toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // now delete the purchase items api for user:
    app.delete("/orders-part/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const decodedEmail = req.decoded.email;
      // get the current email:
      const email = req.headers.email;

      if (email === decodedEmail) {
        const deletedProduct = { _id: ObjectId(id) };
        const result = await purchasedPartsCollection.deleteOne(deletedProduct);
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    });

    // post user to the database after login and get a jwt token:
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      // get a jwt token and it's save to the localStorage:
      const token = jwt.sign({ email: email }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send({ result, token });
    });

    // update a user:
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
      console.log(user ? user : "pai nai");
    });

    // get updated user info api:
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    // get all users:
    app.get("/user", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    // admin middleWare (check user is admin or not):
    const verifyAdmin = async (req, res, next) => {
      const admin = req.decoded.email;
      const adminAccount = await usersCollection.findOne({
        email: admin,
      });
      if (adminAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden access" });
      }
    };

    //  which user is admin & get this admin using custom hook in client side:
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    // an admin makes an another user as an admin and update this user as an admin in database:

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      // an admin make which user  as an admin:
      const filter = { email: email };

      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // post review by user:
    app.post("/add-review/:email", verifyJWT, async (req, res) => {
      // reviewsCollection
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      //if requested user and decodedEmail both are same:

      if (email === decodedEmail) {
        const body = req.body;
        // if user doesn't add any star then not to pass this database:
        if (body?.ratingNumber > 0) {
          const result = await reviewsCollection.insertOne(body);
          return res.send(result);
        }
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });

    app.get("/get-review", async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });

    // admin can post or added product api:
    app.post("/add-product", verifyJWT, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await partsCollection.insertOne(data);
      res.send(result);
    });
    app.put(
      "/user/remove-admin/:email",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        // an admin make which user  remove an admin:
        const filter = { email: email };

        const updateDoc = {
          $set: { role: "user" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // get a order item for payment:
    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await purchasedPartsCollection.findOne(query);
      res.send(result);
    });

    // for payment intent post api:
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // AFTER SUCCESSFULLY PAYMENT THEN UPDATE THE purchasedPartsCollection WITH paid:true && also passes transaction's info in the newly created purchasedPartsCollection
    app.patch("/pay-orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const payment = req.body;
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentsCollection.insertOne(payment);
      const updateOrder = await purchasedPartsCollection.updateOne(
        filter,
        updatedDoc
      );
      sendPaymentEmail(payment);
      res.send({ updateOrder, result });
    });

    // for manage all order by admin:
    app.get("/manage-orders", verifyJWT, async (req, res) => {
      const result = await purchasedPartsCollection.find({}).toArray();
      res.send(result);
    });

    app.delete(
      "/delete-order/:id",
      verifyJWT,
      verifyAdmin,

      async (req, res) => {
        const id = req.params.id;

        const result = await purchasedPartsCollection.deleteOne({
          _id: ObjectId(id),
        });
        res.send(result);
      }
    );
  } finally {
  }
}

run().catch(console.dir);

// const email = {
//   from: "myemail@example.com",
//   to: "tanvir15-14402@diu.edu.bd", // An array if you have multiple recipients.

//   subject: "Hey you, awesome!",

//   //You can use "html:" to send HTML email content. It's magic!
//   html: `
//   <b>Wow Big powerful letters</b>
//   <h1>Learning Web Development</h1>
//   `,
//   //You can use "text:" to send plain-text content. It's oldschool!
//   text: "Mailgun rocks, pow pow!",
// };

// app.post("/pay-email", (req, res) => {
//   // nodemailerMailgun.sendMail(email, (err, info) => {
//   //   if (err) {
//   //     console.log(err);
//   //   } else {
//   //     console.log(info);
//   //   }
//   // });

//   res.send({ message: "Email sending..." });
// });

app.get("/", (req, res) => {
  res.send(`This is the mern manufacturing server site`);
});

app.listen(port, () => {
  console.log(`The web server is listening on port ${port}`);
});
