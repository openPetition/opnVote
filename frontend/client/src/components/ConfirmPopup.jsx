'use client';
import React, { useState, useEffect } from "react";
import { useTranslation } from 'next-i18next';

export default function ConfirmPopup(props) {
  const { showModal, modalText, modalHeader, modalConfirmFunction, modalAbortFunction, shouldConfirm, confirmMessage } = props;
  const { t } = useTranslation();
  const [ continueActive, setContinueActive ] = useState(shouldConfirm ? false : true);

  useEffect(() => {
    setContinueActive(shouldConfirm ? false : true)
  }, []);

  return (
    <>
      {showModal && (
        <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 justify-center items-center w-full md:inset-0 max-h-full">
            <div className="relative p-4 w-full max-w-md max-h-full">
                <div className="relative bg-white rounded-lg shadow ">
                    <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t border-gray-600">
                        <h3 className="text-xl font-semibold text-gray-900 ">
                          {modalHeader}
                        </h3>
                    </div>
          
                    <div className="p-5">
                      <div className="pt-5 pb-5">{modalText}</div>

                      {shouldConfirm && (
                        <div className="flex justify-between">
                          <div className="flex items-start">
                            <div className="flex items-center h-5">
                              <input
                                id="confirm"
                                type="checkbox" 
                                checked={continueActive} 
                                onChange={()=>{setContinueActive(!continueActive)}}
                                className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-blue-300 dark:bg-gray-600 dark:border-gray-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800" 
                                required 
                              />
                            </div>
                            <label htmlFor="confirm" className="ms-2 text-sm font-medium text-gray-900 ">{confirmMessage}</label>
                          </div>
                        </div>
                      )}

                      <button
                        disabled={!continueActive} 
                        onClick={modalConfirmFunction} 
                        className={`${continueActive ? ' bg-op-blue-main ' : 'bg-gray-300'} + m-2 p-3 border border-op-blue-main font-bold text-white hover:op-grey-light rounded`}
                      >
                        {t('common.continue')}
                      </button>
                      <button onClick={modalAbortFunction} className="m-2 p-3 bg-white border border-op-blue-main font-bold text-op-blue-main hover:op-grey-light rounded">
                        {t('common.abort')}
                      </button>
                    </div>
                </div>
            </div>
        </div> 
      )}
    </>
  )
}