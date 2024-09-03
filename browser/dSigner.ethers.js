/**
 * @name dSigner.js
 * @version 1.0.4
 * @update Sep 4, 2024
 * @license MIT License
 * @author [DOMECLOUD] THANARAT KUAWATTANAPHAN <thanarat@dome.cloud>
 * @dependencies ethers.js@5
 */
class dSigner extends ethers.Signer {

    /**
     * @param {Object} config - Configuration object containing API URL, address, and access token.
     * @param {ethers.providers.Provider} provider - Optional provider to use with the signer.
     */
    constructor(config, provider) {
        super();
        this.api_url = 'https://dsigner-api.project.in.th';
        if(arguments.length === 1){
            this.provider = config;
        }else if(arguments.length === 2){
            this.api_url = config.api_url.replace(/\/$/, '');
            this.address = config.address || null;
            this.access_token = config.access_token || null;
            this.provider = provider || ethers.getDefaultProvider();
        }
    }

    /**
     * Sign up a new user with email and password. 
     * @note Check your inbox for email confirmation after sign-up.
     * @param {string} email - The user's email.
     * @param {string} password - The user's password.
     * @returns {Promise<Object>} Response object from the server.
     */
    async signUp(email, password) {
        const response = await fetch(`${this.api_url}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return response.json();
    }

    /**
     * Sign in a user with email and password.
     * @param {string} email - The user's email.
     * @param {string} password - The user's password.
     * @returns {Promise<Object>} Response object containing user data and access token.
     */
    async signIn(email, password) {
        const response = await fetch(`${this.api_url}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();

        // Store the returned address and access token
        this.address = result.user.wallet;
        this.access_token = result.session.access_token;

        return result;
    }

    /**
     * Set an existing access_token to this instance and fetch the corresponding address.
     * @param {string} access_token - Access token in JWT format.
     * @returns {Promise<dSigner>} The instance of the signer connected to the new provider.
     * @throws Will throw an error if the access_token is invalid.
     */
    async setAccessToken(access_token) {
        this.access_token = access_token;
        const response = await fetch(`${this.api_url}/wallet/getAddress`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': this.access_token
            }
        });

        const result = await response.json();

        if (result.wallet) {
            this.address = result.wallet;
            return this;
        } else {
            throw new Error('Error: Invalid access_token given');
        }
    }

    /**
     * Get the address of the signer.
     * @returns {Promise<string>} The Ethereum address associated with this signer.
     * @throws Will throw an error if the user is not signed in.
     */
    async getAddress() {
        if (!this.address) {
            throw new Error('Error: You need to sign in first');
        }
        return this.address;
    }

    /**
     * Sign a transaction using the remote API.
     * @param {Object} transaction - The transaction object to sign.
     * @returns {Promise<string>} The signed transaction as a hex string.
     * @throws Will throw an error if the user is not signed in or if signing fails.
     */
    async signTransaction(transaction) {
        if (!this.access_token) {
            throw new Error('Error: You need to sign in first');
        }

        const populatedTx = await this.populateTransaction(transaction);
        const txData = {
            ...populatedTx,
            nonce: ethers.utils.hexlify(populatedTx.nonce),
            gasLimit: ethers.utils.hexlify(populatedTx.gasLimit),
            maxFeePerGas: ethers.utils.hexlify(populatedTx.maxPriorityFeePerGas),
            maxPriorityFeePerGas: ethers.utils.hexlify(populatedTx.maxPriorityFeePerGas),
            value: populatedTx.value ? ethers.utils.hexlify(populatedTx.value) : undefined
        };

        try {
            const response = await fetch(`${this.api_url}/wallet/signTransaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': this.access_token
                },
                body: JSON.stringify({ transaction: txData })
            });

            const result = await response.json();

            if (!result.signedTransaction) {
                throw new Error('Invalid access_token, please setAccessToken() or signIn() again');
            }

            return result.signedTransaction;

        } catch (error) {
            throw new Error(`Transaction signing failed: ${error.message}`);
        }
    }

    /**
     * Sign a message using the remote API.
     * @param {string} message - The message to sign.
     * @returns {Promise<string>} The signed message as a hex string.
     * @throws Will throw an error if the user is not signed in or if signing fails.
     */
    async signMessage(message) {
        if (!this.access_token) {
            throw new Error('Error: You need to sign in first');
        }

        try {
            const response = await fetch(`${this.api_url}/wallet/signMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': this.access_token
                },
                body: JSON.stringify({ message })
            });

            const result = await response.json();

            if (!result.signedMessage) {
                throw new Error('Invalid access_token, please setAccessToken() or signIn() again');
            }

            return result.signedMessage;

        } catch (error) {
            throw new Error(`Message signing failed: ${error.message}`);
        }
    }

    /**
     * Connect this signer to a new provider.
     * @param {ethers.providers.Provider} provider - The provider to connect to.
     * @returns {dSigner} The instance of the signer connected to the new provider.
     */
    connect(provider) {
        this.provider = provider;
        return this;
    }
}