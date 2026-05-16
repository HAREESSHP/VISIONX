require('dotenv').config({ path: 'C:/Users/HAREESH/Documents/VISIONX/backend/.env' });
const Razorpay = require('razorpay');

console.log("KEY ID:", process.env.RAZORPAY_KEY_ID);
console.log("KEY SECRET:", process.env.RAZORPAY_KEY_SECRET);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function test() {
  try {
    const order = await razorpay.orders.create({
      amount: 100,
      currency: 'INR',
      receipt: 'rcpt_1234'
    });
    console.log("ORDER SUCCESS:", order);
  } catch (err) {
    console.error("ORDER ERROR:", JSON.stringify(err, null, 2));
  }
}

test();
