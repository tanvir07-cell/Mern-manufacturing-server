const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
var jwt = require("jsonwebtoken");
const cors = require("cors");

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
    // const verifyAdmin = async (req, res, next) => {
    //   const adminEmail = req.decoded.email;
    //   const adminAccount = await usersCollection.findOne({ email: adminEmail });

    //   if (adminAccount.role === "admin") {
    //     next();
    //   } else {
    //     res.status(403).send({ message: "Forbidden Access" });
    //   }
    // };

    //  which user is admin & get this admin using custom hook in client side:
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    // an admin makes an another user as an admin and update this user as an admin in database:

    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      // an admin make which user  as an admin:
      const adminEmail = req.decoded.email;
      const adminAccount = await usersCollection.findOne({ email: adminEmail });
      if (adminAccount?.role === "admin") {
        const filter = { email: email };

        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
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
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`This is the mern manufacturing server site`);
});

app.listen(port, () => {
  console.log(`The web server is listening on port ${port}`);
});
