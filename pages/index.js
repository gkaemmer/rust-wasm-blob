import SoftBody from "../components/SoftBody";
import Head from "next/head";

export default () => (
  <div>
    <Head>
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
