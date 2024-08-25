import express from 'express';
import { Router } from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Create a Supabase client instance
function supabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Fetch the user's wallet information using their access token
async function getUserWallet(access_token) {
    try {
        // Fetch user data from Supabase using the access token
        const { data, error } = await supabase().auth.getUser(access_token);
        if (error) {
            throw new Error('Failed to fetch user from Supabase');
        }

        // Fetch wallet data associated with the user
        const { data: existingUser, error: fetchError } = await supabase()
            .from('wallets')
            .select('*')
            .eq('user_id', data.user.id)
            .single();

        if (fetchError) {
            throw new Error('Invalid access token or user not found');
        }

        // Return the user's wallet address
        return { error: false, wallet: existingUser.wallet };
    } catch (err) {
        return { error: true, message: err.message };
    }
}

const router = Router();

// Default route: Returns a simple hello message
router.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello!' });
});

// Serve a welcome HTML page
router.get('/auth/welcome', (req, res) => {
    res.sendFile(path.resolve('welcome.html')); // Serve the welcome page
});

// Verify a user's email using a token
router.post('/auth/verify', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
    }

    try {
        const { data, error } = await supabase().auth.getUser(token);
        if (error) throw new Error(error.message);

        res.status(200).json({ message: 'Email verified successfully!', user: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Sign up a new user with email and password
router.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase().auth.signUp({ email, password });
        if (error) throw new Error(error.message);

        res.status(200).json({ user: data.user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Resend a new OTP to the user
router.post('/auth/newOTP', async (req, res) => {
    const { email } = req.body;

    try {
        const { error } = await supabase().auth.resend({ type: 'signup', email });
        if (error) throw new Error(error.message);

        res.status(200).json({ message: 'New OTP sent' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Sign in a user and manage wallet creation if needed
router.post('/auth/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Sign in the user with Supabase
        const { data, error } = await supabase().auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);

        // Check if the user already has a wallet in the database
        const { data: existingUser, error: fetchError } = await supabase()
            .from('wallets')
            .select('*')
            .eq('user_id', data.user.id)
            .single();

        if (fetchError && fetchError.details === 'The result contains 0 rows') {
            // If no wallet found, create a new wallet via Thirdweb API
            const wallet = await axios.post(
                `${process.env.THIRDWEB_URL}/backend-wallet/create`,
                { label: data.user.id },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.THIRDWEB_BEARER_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (wallet.data.result.status === 'success') {
                // Insert the new wallet into Supabase
                const { error: insertError } = await supabase().from('wallets').insert([{
                    user_id: data.user.id,
                    email: data.user.email,
                    wallet: wallet.data.result.walletAddress,
                }]);

                if (insertError) {
                    throw new Error('Error creating user wallet on Supabase');
                }

                data.user.wallet = wallet.data.result.walletAddress;
            } else {
                throw new Error('Error creating user wallet on Thirdweb');
            }
        } else {
            // If wallet exists, use the existing wallet
            data.user.wallet = existingUser.wallet;
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Retrieve the user's wallet address based on their access token
router.get('/wallet/getAddress', async (req, res) => {
    const { access_token } = req.headers;

    if (!access_token) {
        return res.status(400).json({ error: 'access_token in the header request is required' });
    }

    const { error, wallet, message } = await getUserWallet(access_token);
    if (error) {
        return res.status(400).json({ error: message });
    }

    return res.status(200).json({ wallet });
});

// Sign a transaction using the user's wallet
router.post('/wallet/signTransaction', async (req, res) => {
    const { access_token } = req.headers;
    const { transaction } = req.body;

    if (!access_token) {
        return res.status(400).json({ error: 'access_token in the header request is required' });
    }

    if (!transaction) {
        return res.status(400).json({ error: 'transaction in the body request is required' });
    }

    try {
        const { error, wallet, message } = await getUserWallet(access_token);
        if (error) throw new Error(message);

        const signedTransaction = await axios.post(
            `${process.env.THIRDWEB_URL}/backend-wallet/sign-transaction`,
            { transaction },
            {
                headers: {
                    'x-backend-wallet-address': wallet,
                    'x-idempotency-key': `dsigner_${wallet}_${transaction.nonce}`,
                    'Authorization': `Bearer ${process.env.THIRDWEB_BEARER_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.status(200).json({ signedTransaction: signedTransaction.data.result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Sign a message using the user's wallet
router.post('/wallet/signMessage', async (req, res) => {
    const { access_token } = req.headers;
    const { message } = req.body;

    if (!access_token) {
        return res.status(400).json({ error: 'access_token in the header request is required' });
    }

    if (!message) {
        return res.status(400).json({ error: 'message in the body request is required' });
    }

    try {
        const { error, wallet, message: userMessage } = await getUserWallet(access_token);
        if (error) throw new Error(userMessage);

        const signedMessage = await axios.post(
            `${process.env.THIRDWEB_URL}/backend-wallet/sign-message`,
            { message, isBytes: false },
            {
                headers: {
                    'x-backend-wallet-address': wallet,
                    'x-idempotency-key': `dsigner_${wallet}_${new Date().getTime()}`,
                    'Authorization': `Bearer ${process.env.THIRDWEB_BEARER_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.status(200).json({ signedMessage: signedMessage.data.result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Initialize the Express app and apply middleware
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());  // Enable CORS
app.use(express.json());  // Parse JSON request bodies
app.use(router);  // Use the router with defined routes

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});