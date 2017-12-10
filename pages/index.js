import SoftBody from "../src/SoftBody";
import Head from "next/head";

// Bootleg feature detection
const innerWidth = process.browser ? window.innerWidth : 401;

export default () => (
  <div>
    <Head>
      <title>The Blob</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <style jsx global>{`
      body {
        margin: 0;
      }
    `}</style>
    <SoftBody />
  </div>
);
