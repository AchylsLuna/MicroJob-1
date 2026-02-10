import { Xendit } from 'xendit-node';
import Wallet from '../models/Wallet.js';
import Transaction from '../models/Transaction.js';
import dotenv from 'dotenv';

dotenv.config();

const xenditClient = new Xendit({
    secretKey: process.env.XENDIT_SECRET_KEY,
});
const { Invoice } = xenditClient;

// Top-up e-wallet
export const createTopUp = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount } = req.body;

        // 1. Force Amount to be a Number
        const amountNum = Number(amount); 

        if (!amountNum || amountNum < 100) {
            return res.status(400).json({ message: "Minimum amount is 100" });
        }

        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) wallet = await Wallet.create({ user: userId });

        const invoiceData = {
            amount: amountNum, 
            externalId: `TOPUP-${Date.now()}-${userId}`,
            description: `Wallet Top-up for User ${userId}`,
            currency: 'PHP',
            reminderTime: 1,
        };

        // Only add email if it exists and is valid
        if (req.user.email && req.user.email.includes('@')) {
            invoiceData.payerEmail = req.user.email;
        }

        const response = await Invoice.createInvoice({ data: invoiceData });

        await Transaction.create({
            wallet: wallet._id,
            type: 'TOPUP',
            amount: amountNum,
            referenceId: response.id,
            status: 'PENDING',
            description: 'Waiting for payment'
        });

        res.status(200).json({ paymentUrl: response.invoiceUrl });

    } catch (error) {
        console.error("Xendit Error Details:", JSON.stringify(error.response, null, 2));
        
        res.status(500).json({ 
            message: "Top-up failed",
            details: error.response?.errors || error.message 
        });
    }
};

export const xenditWebhook = async (req, res) => {
    try {
        const { status, id } = req.body;
        if (status === 'PAID') {
            const transaction = await Transaction.findOne({ referenceId: id });

            if (transaction && transaction.status === 'PENDING') {
                transaction.status = 'COMPLETED';
                await transaction.save();
                const wallet = await Wallet.findById(transaction.wallet);
                wallet.balance += transaction.amount;
                await wallet.save();
                
                console.log(`Wallet topped up: ${transaction.amount}`);
            }
        }
        res.status(200).json({ message: "Webhook received" });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ message: "Webhook failed" });
    }
};