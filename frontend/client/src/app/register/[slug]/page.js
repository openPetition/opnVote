'use client';

import React, { useState, useEffect } from "react";
import Alert from "../../../components/Alert";
import Loading from "../../../components/Loading";
import {useStepStore} from "./zustand";
import Stepuploadsecret from "./Stepuploadsecret";
import Steps from "./Steps";
import { useLazyQuery, gql } from '@apollo/client';

const GET_ELECTION = gql`
  query election($id: ID!) {
    election(id: $id)  {
    id,
    totalVotes,
    startTime,
    endTime,
    descriptionBlob
  }
}`;

export default function Home({ params }) {
  const [ election, setElection ] = useState();

  const [getElection, { loading, data }]  = useLazyQuery(GET_ELECTION, { variables: { id: params.slug } });
  useEffect(() => {getElection()}, []);

  const activestep = useStepStore((state) => state.step)

  return (
    <>
      {loading && (
        <>
          <Loading loadingText="Warten auf Wahldaten"/>
        </>
      )}

      {!loading && !data?.election && (
        <>
          <Alert 
            alertType="error"
            alertText="keine Wahldaten vorhanden!"
          />
        </>
      )}

      {!loading && data?.election && (
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
