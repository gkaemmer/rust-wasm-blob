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
      .help {
        text-align: right;
        padding: 15px;
        font-family: system-ui, Helvetica, sans-serif;
        line-height: 1.5em;
        color: #aaa;
      }
    `}</style>
    <SoftBody />
    <div className="help">
      {innerWidth > 400 && <span>Arrow keys to move<br /></span>}
      <span>Drag to throw</span>
    </div>
  </div>
);
