import express from 'express';
import { Router } from 'express';
import cors from 'cors';
import path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

function supabase() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getUserWallet(access_token) {

    const { data, error } = await supabase().auth.getUser(access_token);

    if (error) {
        return {
            error: true,
            message: error
        }
    }

    const { data: existingUser, error: fetchError } = await supabase()
        .from('wallets')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

    if (fetchError) {
        return {
            error: true,
            message: 'Invalid access_token'
        }
    }

    return {
        error: false,
        message: {
            wallet: existingUser.wallet
        }
    }
}

const router = Router();

router.get('/', async (req, res) => {
    res.status(200).json({
        message: 'Hello!'
    });
});

router.get('/auth/welcome', async (req, res) => {
    res.sendFile(path.resolve('welcome.html')); // Use path.resolve for correct path resolution
});

router.post('/auth/verify', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
    }

    const { data, error } = await supabase().auth.getUser(token);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Email verified successfully!', user: data });
});

router.post('/auth/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase().auth.signUp({
        email: email,
        password: password
    });

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ user: data.user });
});

router.post('/auth/newOTP', async (req, res) => {
    const { email } = req.body;
    const { error } = await supabase().auth.resend({
        type: 'signup',
        email: email
    });

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json({ message: 'New OTP sent', error: error });
});

router.post('/auth/signin', async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase().auth.signInWithPassword({ email, password });

    if (error) return res.status(400).json({ error: error.message });

    const { data: existingUser, error: fetchError } = await supabase()
        .from('wallets')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

    if (fetchError && fetchError.details === 'The result contains 0 rows') {

        const wallet = await axios.request({
            method: 'post',
            url: process.env.THIRDWEB_URL + '/backend-wallet/create',
            headers: {
                'Authorization': 'Bearer ' + process.env.THIRDWEB_BEARER_TOKEN,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify({
                label: data.user.id
            })
        });

        if (wallet.data.result.status === 'success') {

            const { error: insertError } = await supabase().from('wallets').insert([{
                user_id: data.user.id,
                email: data.user.email,
                wallet: wallet.data.result.walletAddress
            }]);

            if (insertError) {
                return res.status(500).json({ error: 'Error creating user wallet on Supabase', message: insertError });
            }

            data.user.wallet = existingUser?.wallet || wallet.data.result.walletAddress;
        } else {
            return res.status(500).json({ error: 'Error creating user wallet on Thirdweb' });
        }
    } else {
        data.user.wallet = existingUser.wallet;
    }
    res.status(200).json(data);
});

router.get('/wallet/getAddress', async (req, res) => {
    const { access_token } = req.headers;
    if (!access_token) {
        return res.status(400).json({ error: 'access_token in the header request is required' });
    }

    const { error, message } = await getUserWallet(access_token);

    if (error) {
        return res.status(400).json(message);
    } else {
        return res.status(200).json(message);
    }
});

router.post('/wallet/signTransaction', async (req, res) => {

});

router.post('/wallet/signMessage', async (req, res) => {
    const { access_token } = req.headers;
    if (!access_token) {
        return res.status(400).json({ error: 'access_token in the header request is required' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'message in the body request (raw) is required' });
    }

    const { error, message: user } = await getUserWallet(access_token);

    if (error) {
        return res.status(400).json(user);
    } else {

        const signedMessage = await axios.request({
            method: 'post',
            url: process.env.THIRDWEB_URL + '/backend-wallet/sign-message',
            headers: {
                'x-backend-wallet-address': user.wallet,
                'x-idempotency-key': '<string>',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + process.env.THIRDWEB_BEARER_TOKEN,
            },
            data: {
                "message": message,
                "isBytes": false
            }
        })

        return res.status(200).json({
            signedMessage: signedMessage.data.result
        });
    }


});

const app = express();
const port = process.env.PORT || 3000;

// Apply CORS middleware
app.use(cors());  // Use this line to enable CORS

app.use(express.json());
app.use(router);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});