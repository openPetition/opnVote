'use client';

import React, { useState, useEffect } from "react";

import QRCode from "react-qr-code";
import Image from "next/image";
import {useStepStore} from "./zustand";
import Stepuploadsecret from "./Stepuploadsecret";
import Steps from "./Steps";



export default function Home({ params }) {

  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState('');
  const activestep = useStepStore((state) => state.step)

  function callClick() {

  }

  return (
    <>
      <div className="bg-op-grey-light">
        <div className="p-4">
          <h3 className="text-center font-bold py-2">Wahlschein beantragen</h3>
          <p>Abstimmung: {params.slug}</p>
          <p>Wahlkoordinator:</p>
          <p>Wähler Authentifikation:</p>
          <p>Wahl Hash:</p>
        </div>

      </div>
      <Steps />

       ---STEP:  {activestep} --- 

       {activestep == 2 && (
          <>
            <Stepuploadsecret />
          </>
        )
      }


    </>
  );
}
