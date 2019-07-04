require('dotenv').config()
const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bodyParser = require('body-parser');
const WooCommerceAPI = require('woocommerce-api');
const axios = require('axios');
// const testData = require('./testData.json');
const cron = require('node-cron');


const WooCommerce = new WooCommerceAPI({
    url: 'https://kingdomsgf.com',
    consumerKey: process.env.CONS_KEY,
    consumerSecret: process.env.CONS_SEC,
    wpAPI: true,
    version: 'wc/v3'
    // queryStringAuth: true
});

const db = mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    family: 4,
    connectTimeoutMS: 10000,
    auto_reconnect: true
}).catch(err => console.log(err));

const orderSchema = new Schema({
    _id: {
        type: Schema.ObjectId,
        auto: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    created_via: String,
    payment_method: String,
    payment_method_title: String,
    set_paid: Boolean,
    status: String,
    total: String,
    order_type: String,
    parent_id: Number,
    billing: {
        first_name: String,
        last_name: String,
        address_1: String,
        address_2: String,
        city: String,
        state: String,
        postcode: String,
        country: String,
        email: String,
        phone: String
    },
    shipping: {
        first_name: String,
        last_name: String,
        address_1: String,
        address_2: String,
        city: String,
        state: String,
        postcode: String,
        country: String
    },
    line_items: Array,
    shipping_lines: Array
});

const Order = mongoose.model("Order", orderSchema);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

const baseUrl = 'https://kingdomsgf.com/wp-json/wc/v3';


app.get("/", (req, res) => {
    console.log(Date.now() + " Ping Received");
    res.sendStatus(200);
});

app.post('/', (req, res, next) => {
    res.sendStatus(200);
    res.end();

    const order = req.body;
    console.log('Order received');

    //If incoming order was just created by this program, disregard it as to not create an infinite loop.
    if (order.created_via === "rest-api") {
        console.log('Order was already created with rest-api. Will not place new order.');
        return
    } else if (order.status === "processing") {
        // If order has been paid for

        const items = order.line_items;
        let verify = false;

        console.log('Reached just past order === processing');

        // Check all line items to see if they are within a subscription that needs to ship more than once a month
        for (i = 0; i < items.length; i++) {
            if (items[i].name.includes('2 - 12oz Bags Monthly') || items[i].name.includes('4 - 12oz Bags Monthly')) {
                verify = true;
            } else {
                console.log('Item(s) do not need bi-monthly shipping');

            }
        }

        // If items need to ship more than once a month
        if (verify) {

            // Create new order based on order just recieved.     
            const newOrder = new Order({
                payment_method: order.billing.payment_method,
                payment_method_title: order.billing.payment_method_title,
                created_via: "rest-api",
                set_paid: false,
                status: "processing",
                total: "0.00",
                order_type: "renewal_order",
                parent_id: order.parent_id,
                billing: {
                    first_name: order.billing.first_name,
                    last_name: order.billing.last_name,
                    address_1: order.billing.address_1,
                    address_2: order.billing.address_2,
                    city: order.billing.city,
                    state: order.billing.state,
                    postcode: order.billing.postcode,
                    country: order.billing.country,
                    email: order.billing.email,
                    phone: order.billing.phone
                },
                shipping: {
                    first_name: order.shipping.first_name,
                    last_name: order.shipping.last_name,
                    address_1: order.shipping.address_1,
                    address_2: order.shipping.address_2,
                    city: order.shipping.city,
                    state: order.shipping.state,
                    postcode: order.shipping.postcode,
                    country: order.shipping.country
                },
                line_items: order.line_items,
                shipping_lines: order.shipping_lines
            });

            // Save the new order to db
            newOrder.save(function (err, order) {
                if (err) {
                    console.log(err);
                } else {
                    console.log(`This order saved to db: ${order._id}`);
                }
            });

        }

    }

});

//Run a cron job every day that queries all orders stored in db
const queryschedule = cron.schedule('0 8 * * *', () => {
    console.log('Running a job at 08:00 at America/Chicago timezone');

    Order.find({}, '-line_items -shipping_lines', function (err, orders) {
        if (err) {
            console.log(err);
        } else {

            let ordersArr = [];

            orders.forEach(function (order) {
                // Taken from Punit Jajodia https://www.toptal.com/software/definitive-guide-to-datetime-manipulation
                const dateOfOrder = order.date;
                const now = new Date();
                const datefromAPITimeStamp = (new Date(dateOfOrder)).getTime();
                const nowTimeStamp = now.getTime();

                const microSecondsDiff = Math.abs(datefromAPITimeStamp - nowTimeStamp);
                // Number of milliseconds per day =
                //   24 hrs/day * 60 minutes/hour * 60 seconds/minute * 1000 msecs/second
                const daysDiff = Math.floor(microSecondsDiff / (1000 * 60 * 60 * 24));

                // If it is exactly 15 days from the triggering order, post the new order
                if (daysDiff === 15) {
                    ordersArr.push(order);
                }
            });

            ordersArr.forEach(function (order) {
                axios.post(baseUrl + `/orders?consumer_key=${process.env.CONS_KEY}&consumer_secret=${process.env.CONS_SEC}`, order)
                    .then(function (response) {
                        // console.log(response)
                        //Remove orders from db after they are created
                        Order.deleteOne({
                            _id: order._id
                        }, function (err, result) {
                            if (err) {
                                console.log(err);
                                queryschedule.stop();
                            } else if (result) {
                                console.log('Removed');
                            }
                        });
                    })
                    .catch(function (error) {
                        // handle error
                        console.log('There was an error sending new order to Kingdom ::: ', error);
                    })
                    .then(function () {

                    });
            });

        }
    });
}, {
    scheduled: true,
    timezone: "America/Chicago"
});

app.listen(process.env.PORT || port, setInterval(() => {
    http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`);
  }, 280000));