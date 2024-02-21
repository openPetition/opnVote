'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import Image from "next/image";
import { generateMasterTokenAndMasterR, concatTokenAndRForQR } from "votingsystem";

export default function Home({ params }) {

  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');

  async function callClick() {
    setLoading('loading');
    let values = await generateMasterTokenAndMasterR();
    console.log(values);
    let create = await concatTokenAndRForQR(values.masterToken, values.masterR);
    console.log(create);
    setSecret(create);
    setLoading('loaded');
  }

  return (
    <main className="">

      <div className="bg-op-blue">
        <div className="flex-col items-center justify-between p-5 text-sm">
        {params.slug}
                </div>
      </div>


    </main>
  );
}
