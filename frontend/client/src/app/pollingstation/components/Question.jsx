'use client';
import React, { useState, useEffect } from "react";

export default function Question(props) {
    const { question, style, selected, changeSelection } = props;

    useEffect(() => {

        switch (style) {
        case 'error':
            setHeadLine('Fehler:');
            setAlertClasses('bg-red-100 border border-red-400 text-red-700');
            break;
        case 'confirm':
            setHeadLine('');
            setAlertClasses('bg-green-100 border border-green-400 text-green-700');
            break;
        case 'note':
            setHeadLine('');
            setAlertClasses('bg-white-100 border border-gray-400 text-black-700');
            break;
        }
    }, []);

    return (
        <>
            <div className="op__outerbox_grey">
                <h4>{question}</h4>
            </div>
        </>
    );
}
