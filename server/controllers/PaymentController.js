// controllers/PaymentController.js
import axios from 'axios';
import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

export async function createTopUpSession(req, res) {
    try {
        const { amount } = req.body; // Amount in PHP
        const userId = req.user.id;

        // PayMongo expects amounts in centavos (multiply by 100)
        const amountInCentavos = amount * 100;

        const options = {
            method: 'POST',
            url: 'https://api.paymongo.com/v1/checkout_sessions',
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                // Encode your Secret Key in Base64
                authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`
            },
            data: {
                data: {
                    attributes: {
                        payment_method_types: ['gcash'],
                        line_items: [{
                            currency: 'PHP',
                            amount: amountInCentavos,
                            name: 'E-Wallet Top Up',
                            quantity: 1
                        }],
                        // A reference ID to track who is topping up
                        reference_number: `TOPUP-${userId}-${Date.now()}`, 
                        success_url: 'http://localhost:5173/topup-success', // Your React frontend URL
                        cancel_url: 'http://localhost:5173/wallet'
                    }
                }
            }
        };

        const response = await axios.request(options);
        
        // Return the checkout URL to the frontend so the user can click it
        res.status(200).json({ checkoutUrl: response.data.data.attributes.checkout_url });

    } catch (error) {
        console.error("PayMongo Error:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to initiate top-up." });
    }
}

export async function handleWebhook(req, res) {
    try {
        const signatureHeader = req.headers['paymongo-signature'];
        const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

        // 1. Security Check: Verify the signature
        if (!signatureHeader) {
            return res.status(400).send('Webhook Error: No signature found');
        }

        // PayMongo sends timestamp (t) and signature (te) in the header
        const [timestampPart, signaturePart] = signatureHeader.split(',');
        const timestamp = timestampPart.split('=')[1];
        const signature = signaturePart.split('=')[1];

        // Create a signature using your raw payload and secret to compare
        const payloadString = `${timestamp}.${JSON.stringify(req.body)}`;
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(payloadString)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('Webhook signature mismatch!');
            return res.status(400).send('Webhook Error: Invalid signature');
        }

        // 2. Process the Event
        const event = req.body.data;

        if (event.attributes.type === 'checkout_session.payment.paid') {
            const checkoutSession = event.attributes.data.attributes;
            
            // Extract the User ID from the reference number we created earlier
            // e.g., "TOPUP-65d1f8a8e1b2...-1708400000000"
            const referenceNumber = checkoutSession.reference_number;
            const parts = referenceNumber.split('-');
            
            if (parts[0] === 'TOPUP' && parts[1]) {
                const userId = parts[1];
                
                // PayMongo's webhook usually stores the paid amount in the 'payments' array
                let amountAdded = 0;

                if (checkoutSession.payments && checkoutSession.payments.length > 0) {
                    amountAdded = checkoutSession.payments[0].attributes.amount / 100;
                } else if (checkoutSession.line_items && checkoutSession.line_items.length > 0) {
                    // Fallback just in case
                    amountAdded = checkoutSession.line_items[0].amount / 100;
                } else {
                    console.error("Could not find payment amount in webhook payload:", checkoutSession);
                    return res.status(400).send('Webhook Error: Could not find payment amount');
                }

                // 3. Update the User's Wallet
                const user = await User.findById(userId);
                if (user) {
                    user.walletBalance += amountAdded;
                    await user.save();

                    // 4. Record the Top-Up in your public ledger
                    await Transaction.create({
                        sender: null, // External source
                        receiver: user._id,
                        amount: amountAdded,
                        type: 'TOP_UP'
                    });

                    console.log(`Successfully topped up PHP ${amountAdded} for user ${userId}`);
                }
            }
        }

        // 5. Always return a 200 OK so PayMongo knows you received it
        res.status(200).send('Webhook received');

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Webhook processing failed');
    }
}