'use client';
import React, { useState, useEffect } from "react";

export default function Alert(props) {
  const { alertType, alertText } = props;
  const [ alertClasses, setAlertClasses ] = useState('');
  const [ headLine, setHeadLine ] = useState('');

  useEffect(() => {
    switch (alertType) {
      case 'error':
        setHeadLine('Fehler:');
        setAlertClasses('bg-red-100 border border-red-400 text-red-700');
        break;
      case 'confirm':
        setHeadLine('');
        setAlertClasses('bg-green-100 border border-green-400 text-green-700');
        break;
    }
  }, []);

  return (
    <>

        <div className={"px-4 py-3 m-2 rounded relative " + alertClasses} role="alert">
          <h3 className="font-bold">{headLine}</h3>
          <span className="block sm:inline">{alertText}</span>
        </div>

    </>
  )
}