'use client';
import React, { useState, useEffect } from "react";
import styles from '../styles/Button.module.css';

export default function Button(props) {
  const { text, type, onClickAction, style, isDisabled } = props;

  return (
    <>
        <button 
            onClick={onClickAction}
            disabled={isDisabled}
            className={`${styles.btn} ${styles[type]}`}
            style={style}
        >
            {text}
        </button>
    </>
  )
}