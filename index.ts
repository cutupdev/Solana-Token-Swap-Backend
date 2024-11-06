import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from 'path';
import { TokenData } from "./types";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { fetchAllDigitalAssetWithTokenByOwner } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import {
  Connection,
} from '@solana/web3.js';
import { sleep } from "./utils";

import { PORT, connectMongoDB } from "./config";
import http from "http";

const rpcUrl: any = process.env.RPC;
const connection = new Connection(rpcUrl);

// Load environment variables from .env file
dotenv.config();

// Connect to the MongoDB database
connectMongoDB();

// Create an instance of the Express application
const app = express();

// Set up Cross-Origin Resource Sharing (CORS) options
const whitelist = [
  "http://localhost:4000"
];
const corsOptions = {
  origin: whitelist,
  credentials: false,
  sameSite: "none",
};
app.use(cors(corsOptions));

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, './public')));

// Parse incoming JSON requests using body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);



// Define routes for different API endpoints
app.use("/getTokens", async (req, res) => {
  try {
    const options = { method: 'GET', headers: { 'X-API-KEY': String(process.env.BIRDEYE_KEY) } };
    const umi = createUmi(new Connection("https://mainnet.helius-rpc.com/?api-key=99c6d984-537e-4569-955b-5e4703b73c0d"));
    umi.use(dasApi());

    // The owner's public key
    const ownerPublicKey = publicKey(
      req.body.walletAddress,
    );
    const allFTs = await fetchAllDigitalAssetWithTokenByOwner(
      umi,
      ownerPublicKey,
    );

    let tokePrice: number;
    await fetch(`https://public-api.birdeye.so/defi/price?address=${process.env.MINT_ADDRESS}`, options)
      .then(response => response.json())
      .then(response => {
        tokePrice = Number(response.data.value);
      })
      .catch(err => console.error(err));

    let j = 0;
    let datas: TokenData[] = [];
    for (let i = 0; i < allFTs.length; i++) {
      if ((allFTs[i].mint.decimals > 0) && (allFTs[i].metadata.symbol !== 'USDC') && (allFTs[i].metadata.symbol !== 'USDT') && (allFTs[i].publicKey !== 'AmgUMQeqW8H74trc8UkKjzZWtxBdpS496wh4GLy2mCpo')) {
        let price: number;
        await sleep(200 * j)

        await fetch(`https://public-api.birdeye.so/defi/price?address=${allFTs[i].publicKey}`, options)
          .then(response => response.json())
          .then(response => {
            price = Number(response.data.value);
            if (price > 0) {
              datas.push({
                id: allFTs[i].publicKey,
                mintSymbol: allFTs[i].metadata.symbol,
                decimal: Number(allFTs[i].mint.decimals),
                balance: Number(allFTs[i].token.amount),
                price: price,
                balanceByToke: Math.floor(price * Number(allFTs[i].token.amount) / Math.pow(10, Number(allFTs[i].mint.decimals)) / tokePrice * 1000)
              })
            } 
          })
          .catch(err => console.error(err));
        j++;
      }
    }
    console.log('tokenData ===> ', datas)
    return res.json({ data: datas });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err });
  }
});

// Define a route to check if the backend server is running
app.get("/", async (req: any, res: any) => {
  res.send("Backend Server is Running now!");
});

// Start the Express server to listen on the specified port
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
