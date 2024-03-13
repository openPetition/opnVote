'use client';
import React, { useState, useEffect } from "react";

export default function Footer() {

    return (
      <>

        <footer>
            <div className="bg-op-blue-main">

                <div className="p-6 flex-wrap">
                    <div className="text-white">Helfen Sie mit, Bürgerbeteiligung zu stärken. Wir wollen Ihren Anliegen Gehör verschaffen und dabei weiterhin unabhängig bleiben.</div>
                    <div className="text-white bg-op-blue-dark text-center mx-auto rounded w-1/2 block p-2 my-2">
                        Jetzt Fördern
                    </div>
                </div>
            </div>
            <div className="bg-op-grey-light">
                <div className="p-6 flex-wrap ">

                    <div className="flex flex-col md:flex-row sm:w-4/6 md:w-full md:flex-row p-6 flex-wrap w-full ">
                        <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white">selbstorganisiert</span>
                        <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white">gemeinnützig</span>
                        <span className="text-gray-500 hover:text-gray-900 dark:hover:text-white">demokratisch</span>
                    </div>
                </div>
            </div>
            <div className="bg-op-grey-dark">
                <div className="flex flex-col md:flex-row p-6 flex-wrap w-full">
                    <div className="text-center md:text-left">
                        © 2024 <a href="https://openpetition.net/" className="hover:underline">openPetition gGmbH</a>
                    </div>

                    <div className="text-center md:text-left">
                        <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">Datenschutz | </a>
                        <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">Impressum | </a>
                        <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">Transparenz</a>
                    </div>

                    <div className="text-center md:text-left">
                        <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                            <svg className="w-4 h-4 inline-block" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 8 19">
                                    <path ffillrule="evenodd" d="M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z" clipRule="evenodd"/>
                                </svg>
                            <span className="sr-only">Facebook Seite</span>
                        </a>
                        <a href="#" className="text-gray-500 hover:text-gray-900 dark:hover:text-white ms-5">
                            <svg className="w-4 h-4 inline-block" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 17">
                                <path ffillrule="evenodd" d="M20 1.892a8.178 8.178 0 0 1-2.355.635 4.074 4.074 0 0 0 1.8-2.235 8.344 8.344 0 0 1-2.605.98A4.13 4.13 0 0 0 13.85 0a4.068 4.068 0 0 0-4.1 4.038 4 4 0 0 0 .105.919A11.705 11.705 0 0 1 1.4.734a4.006 4.006 0 0 0 1.268 5.392 4.165 4.165 0 0 1-1.859-.5v.05A4.057 4.057 0 0 0 4.1 9.635a4.19 4.19 0 0 1-1.856.07 4.108 4.108 0 0 0 3.831 2.807A8.36 8.36 0 0 1 0 14.184 11.732 11.732 0 0 0 6.291 16 11.502 11.502 0 0 0 17.964 4.5c0-.177 0-.35-.012-.523A8.143 8.143 0 0 0 20 1.892Z" clipRule="evenodd"/>
                            </svg>

                            <span className="sr-only">Twitter Seite</span>
                        </a>
                    </div>
                </div>
            </div>

        </footer>

      </>
    )
}