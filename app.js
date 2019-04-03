require('dotenv').config()


const express = require('express');
const app = express();
const port = 3000;
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bodyParser = require('body-parser');
const WooCommerceAPI = require('woocommerce-api');
const axios = require('axios');
const order = require('./testData.json');
 
const WooCommerce = new WooCommerceAPI({
    url: 'https://kingdomsgf.com',
    consumerKey: process.env.CONS_KEY,
    consumerSecret: process.env.CONS_SEC,
    wpAPI: true,
    version: 'wc/v3'
    // queryStringAuth: true
});

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});

const orderSchema = new Schema({
    date: { type : Date, default: Date.now },
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
app.use(bodyParser.urlencoded({ extended: true }));


const baseUrl = 'https://kingdomsgf.com/wp-json/wc/v3';

    if(order.status === "processing") {

        const items = order.line_items;
        let verify = false;

        for(i = 0; i < items.length; i++) {
            if(items[i].name.includes('2 - 12oz Bags Monthly') ||  items[i].name.includes('4 - 12oz Bags Monthly')) {
                verify = true;
            }
        }

        // console.log(verify); 
        
        if(verify) {

            const newOrder = new Order({
                payment_method: order.billing.payment_method,
                payment_method_title: order.billing.payment_method_title,
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
            
            // newOrder.save(function (err) {
            //     if (err) {
            //         console.log(err);
            //     } else {
            //         console.log('Saved to db');
            //     }
            //   });

            Order.find({},'-_id line_items shipping_lines' , function(err, orders) {
                if(err) {
                    console.log(err);
                }
                for(i = 0; i < orders.length; i++) {
                    // Taken from Punit Jajodia https://www.toptal.com/software/definitive-guide-to-datetime-manipulation
                    const dateOfOrder = orders[i].date;
                    const now = new Date();
                    const datefromAPITimeStamp = (new Date(dateOfOrder)).getTime();
                    const nowTimeStamp = now.getTime();

                    const microSecondsDiff = Math.abs(datefromAPITimeStamp - nowTimeStamp );
                    // Number of milliseconds per day =
                    //   24 hrs/day * 60 minutes/hour * 60 seconds/minute * 1000 msecs/second
                    const daysDiff = Math.floor(microSecondsDiff/(1000 * 60 * 60  * 24));


                    if (daysDiff === 15) {

                        // ?consumer_key=${process.env.CONS_KEY}&consumer_secret=${process.env.CONS_SEC}

                        // console.log(orders[i]);

                        axios.post(baseUrl + `/orders?consumer_key=${process.env.CONS_KEY}&consumer_secret=${process.env.CONS_SEC}`, orders[i])
                        .then(function (response) {
                            console.log(response.data);

                        })
                        .catch(function (error) {
                            // handle error
                            console.log(error.response.status);
                            // console.log(error);
                        })
                        .then(function () {
                            
                        });
                    }
                }
            });

        }


        
    }




app.get('/', (req, res, next) => { 
    res.sendStatus(200);
    res.end();

});

app.post('/', (req, res, next) => { 
    res.sendStatus(200);
    res.end();
    
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));