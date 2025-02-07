import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { verify_email } from "email-verifier-node";
import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.whalj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Access the portfolio database and emails collection
    const database = client.db("portfolio");
    const collection = database.collection("emails");
    // Send a ping to confirm a successful connection
    await database.command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Nodemailer Transporter Setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    // API Route to send email and save to MongoDB
    app.post("/send-email", async (req, res) => {
      const { name, email, message } = req.body;

      console.log("Received request data:", req.body);

      if (!name || !email || !message) {
        console.log("Validation error: All fields are required!");
        return res.status(400).json({ error: "All fields are required!" });
      }

      try {
        // Verify email
        const verificationResult = await verify_email(
          email,
          process.env.EMAIL_VERIFIER_API_KEY
        );

        if (!verificationResult.is_verified) {
          console.log("Validation error: Invalid email address!");
          return res.status(400).json({ error: "Invalid email address!" });
        }

        // Save to MongoDB
        await collection.insertOne({ name, email, message, date: new Date() });

        // Send email
        await transporter.sendMail({
          from: `"My Portfolio" ${email}`,
          to: process.env.EMAIL_EMAIL,
          subject: `New Contact Form Submission from ${name}`,
          text: message,
          html: `<p><strong>Name:</strong> ${name}</p>
                 <p><strong>Email:</strong> ${email}</p>
                 <p><strong>Message:</strong> ${message}</p>`,
        });

        res.status(200).json({
          success: true,
          message: "Email sent and data saved successfully!",
        });
      } catch (error) {
        console.error("Error sending email or saving data:", error);
        res.status(500).json({
          success: false,
          message: "Email sending or data saving failed!",
          error: error.message,
        });
      }
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}
run().catch(console.dir);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
