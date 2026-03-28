require('dotenv').config({ path: 'C:/Users/HAREESH/Documents/VISIONX/backend/.env' });
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ticketSchema = new mongoose.Schema({
  ticketId:   { type: String, unique: true, required: true },
  name:       { type: String, required: true },
  rollno:     { type: String, required: true },
  email:      { type: String, required: true },
  phone:      { type: String, required: true },
  college:    { type: String, required: true },
  department: { type: String, required: true },
  orderId:    { type: String },
  paymentId:  { type: String },
  amount:     { type: Number, default: 500 },
  status:     { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  scanned:    { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now }
});

const Ticket = mongoose.model('Ticket', ticketSchema);

async function testMongo() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to Mongo");

  try {
    const ticketId = 'VX' + uuidv4().replace(/-/g, '').toUpperCase().slice(0, 8);
    const doc = await Ticket.create({
      ticketId, 
      name: "Test Name", 
      rollno: "12345", 
      email: "test@gmail.com", 
      phone: "9999999999", 
      college: "Test Col", 
      department: "CSE",
      orderId: "order_test",
      status: 'pending'
    });
    console.log("MONGO SUCCESS", doc);
  } catch (err) {
    console.error("MONGO ERROR:", err);
  }
  process.exit();
}
testMongo();
