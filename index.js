const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const app = express();

const cors = require("cors");

// middleware:
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

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
    app.get("/part/:id", async (req, res) => {
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
