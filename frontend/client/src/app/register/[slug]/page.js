'use client';

import React, { useState, useEffect } from "react";


import {useStepStore} from "./zustand";
import Stepuploadsecret from "./Stepuploadsecret";
import Steps from "./Steps";

import { useLazyQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_ELECTION = gql`
  query election($id: ID!) {
    election(id: $id)  {
    id,
    totalVotes,
    startTime,
    descriptionBlob
  }
}`;

export default function Home({ params }) {

  const [getElection, { loading, data }]  = useLazyQuery(GET_ELECTION, { variables: { id: params.slug } });
  useEffect(() => {getElection()}, []);
  useEffect((() => {
    if (data) {
      console.log(JSON.parse(data?.election?.descriptionBlob));
    }
  }
  ),[data]);
  const activestep = useStepStore((state) => state.step)

  return (
    <>
      {loading && (<>Loading Election Data</>)}
      {!loading && (
        <>

        <div className="bg-op-grey-light">
          <div className="p-4">
            <h3 className="text-center font-bold py-2">Wahlschein beantragen</h3>
            <p>Abstimmungsdaten: {data?.election?.descriptionBlob} </p>
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
      )}

    </>
  );
}
