import { ethers } from "ethers";
import dSigner from "./dSigner.ethers.node.js";

async function app(){

    const signer = new dSigner();

    await signer.signIn('earthchie@gmail.com', 'earth123');

    const message = 'Test';

    console.log('Signing the message:', message);
    const signature = await signer.signMessage(message);
    console.log('Message Signed:', signature);


    console.log('Verifing Signature...');
    const signerAddr = await ethers.utils.verifyMessage(message, signature);

    if(signerAddr === signer.address){
        console.log('Signature is Valid!');
    }else{
        console.log('NO! Invalid Signature');
    }

}

app();